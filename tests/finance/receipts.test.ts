import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import type { Database } from "@/lib/db/client";

let db: Database;
const files = new Map<string, { body: ArrayBuffer; type?: string }>();
const DOCS = {
  put: async (key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) => { files.set(key, { body, type: opts?.httpMetadata?.contentType }); },
  get: async (key: string) => {
    const f = files.get(key);
    return f ? { arrayBuffer: async () => f.body, httpMetadata: { contentType: f.type }, body: new Blob([f.body]).stream() } : null;
  },
  delete: async (key: string | string[]) => { for (const k of [key].flat()) files.delete(k); },
};
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/platform/admin", () => ({ requirePlatformAdmin: async () => ({}), platformAdminEmails: () => new Set(["owner@gmail.com"]) }));
vi.mock("@/lib/cf/bindings", () => ({ getDb: async () => db, getEnv: () => ({ DOCS, APP_APEX_DOMAIN: "activityroster.com", ANTHROPIC_API_KEY: "test" }), getRepositories: async () => ({}) }));
vi.mock("@/lib/billing/finance-sync", () => ({ backfillStripeRevenue: async () => ({ invoices: 0, created: 0 }) }));
const reading = vi.fn();
vi.mock("@/lib/finance/receipt-reader", () => ({ readReceipt: (...a: unknown[]) => reading(...a) }));

import { PlatformRepository } from "@/lib/db/repositories/platform";
import { addTransactionAction, deleteTransactionAction } from "@/app/admin/finance/actions";
import { decideInbound, gmailCode, ingestInbound, mailboxOf } from "@/lib/finance/receipt-inbox";
import { domainWords, matchReceipt, namesSupplier, type LineFacts } from "@/lib/finance/receipt-match";

// --- matching (pure) ---------------------------------------------------------

const line = (over: Partial<LineFacts>): LineFacts => ({ id: "l1", date: "2026-10-01", amountMinor: 5_00, currency: "GBP", counterparty: "Cloudflare", description: "Workers paid plan", hasReceipt: false, ...over });
const receipt = { totalMinor: 5_00, currency: "GBP", date: "2026-10-02", supplier: "Cloudflare, Inc.", fromAddress: "noreply@notify.cloudflare.com" };

describe("matching a receipt to a line", () => {
  it("attaches by itself when one line has the amount, the date and the supplier", () => {
    expect(matchReceipt(receipt, [line({}), line({ id: "l2", amountMinor: 6_00 })])).toEqual({ auto: "l1", suggestions: ["l1"] });
  });
  it("only suggests when the supplier doesn't agree", () => {
    expect(matchReceipt(receipt, [line({ counterparty: "Adobe", description: "Acrobat" })])).toEqual({ auto: null, suggestions: ["l1"] });
  });
  it("only suggests when two lines could be it, supplier match first", () => {
    const r = matchReceipt(receipt, [line({ id: "a", counterparty: "Tesco", description: "Milk" }), line({ id: "b" })]);
    expect(r).toEqual({ auto: null, suggestions: ["b", "a"] });
  });
  it("ignores lines in another currency, outside a week, or with a receipt already", () => {
    expect(matchReceipt(receipt, [line({ currency: "EUR" }), line({ id: "l2", date: "2026-10-20" }), line({ id: "l3", hasReceipt: true })]).suggestions).toEqual([]);
  });
  it("knows a supplier by its web domain, and by earlier matches", () => {
    expect(domainWords("no-reply@aws.amazon.com")).toEqual(["aws", "amazon"]);
    expect(domainWords("orders@shop.example.co.uk")).toEqual(["shop", "example"]);
    expect(namesSupplier({ counterparty: "Amazon Web Services", description: "EC2" }, { supplier: null, fromAddress: "no-reply@aws.amazon.com" })).toBe(true);
    const known = new Map([["mail.vendor.io", ["Acme Hosting"]]]);
    expect(namesSupplier({ counterparty: "Acme Hosting", description: "VPS" }, { supplier: "AH Ltd", fromAddress: "x@mail.vendor.io" }, known)).toBe(true);
  });
});

// --- emails in ---------------------------------------------------------------

const TOKEN = "abc123def456";
const TO = `receipts-${TOKEN}@activityroster.com`;
const GMAIL_FWD = `owner+caf_=receipts-${TOKEN}=activityroster.com@gmail.com`;
const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n").toString("base64");

function eml(opts: { from: string; subject: string; id: string; text?: string; html?: string; pdf?: boolean; extra?: string }): ArrayBuffer {
  const parts = [
    `From: ${opts.from}`, "To: owner@gmail.com", `Subject: ${opts.subject}`, `Message-ID: <${opts.id}>`, "Date: Thu, 02 Oct 2026 09:00:00 +0000", "MIME-Version: 1.0",
    ...(opts.extra ? [opts.extra] : []),
    'Content-Type: multipart/mixed; boundary="b1"', "",
    "--b1", opts.html ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8", "", opts.html ?? opts.text ?? "Thanks for your order.",
  ];
  if (opts.pdf) parts.push("--b1", 'Content-Type: application/pdf; name="invoice.pdf"', 'Content-Disposition: attachment; filename="invoice.pdf"', "Content-Transfer-Encoding: base64", "", pdf);
  parts.push("--b1--", "");
  return new TextEncoder().encode(parts.join("\r\n")).buffer as ArrayBuffer;
}
const settings = { receiptInboxToken: TOKEN, receiptForwardFrom: null };
const admins = ["owner@gmail.com"];

describe("what an emailed message is", () => {
  it("treats Gmail's spellings of one mailbox as the same", () => {
    expect(mailboxOf(GMAIL_FWD)).toBe("owner@gmail.com");
    expect(mailboxOf("O.w.n.e.r@GoogleMail.com")).toBe("owner@gmail.com");
  });
  it("accepts any of several forwarding addresses", async () => {
    const two = { receiptInboxToken: TOKEN, receiptForwardFrom: "activityroster@gmail.com, owner@gmail.com" };
    const raw = eml({ from: "Cloudflare <noreply@notify.cloudflare.com>", subject: "Invoice", id: "m1", pdf: true });
    expect((await decideInbound(raw, { from: "activityroster+caf_=x=activityroster.com@gmail.com", to: TO }, two, [])).kind).toBe("receipt");
    expect((await decideInbound(raw, { from: GMAIL_FWD, to: TO }, two, [])).kind).toBe("receipt");
    expect((await decideInbound(raw, { from: "someone@gmail.com", to: TO }, two, [])).kind).toBe("held");
  });
  it("refuses any address but the books' private one", async () => {
    const d = await decideInbound(eml({ from: "a@b.com", subject: "x", id: "1" }), { from: GMAIL_FWD, to: "receipts-guess@activityroster.com" }, settings, admins);
    expect(d.kind).toBe("unknown_address");
  });
  it("picks out Gmail's forwarding confirmation code", async () => {
    const d = await decideInbound(eml({ from: "Gmail Team <forwarding-noreply@google.com>", subject: "(#123456789) Gmail Forwarding Confirmation", id: "g1", text: "Confirmation code: 123456789" }), { from: "forwarding-noreply@google.com", to: TO }, settings, admins);
    expect(d).toMatchObject({ kind: "gmail", code: "123456789" });
  });
  it("finds Gmail's code wherever Google puts it", () => {
    expect(gmailCode("(#987654321) Gmail Forwarding Confirmation - Receive Mail from a@gmail.com", null, null)).toBe("987654321");
    expect(gmailCode("Gmail Forwarding Confirmation", null, "<p>Confirmation code: <b>123456789</b></p>")).toBe("123456789");
    expect(gmailCode("Gmail Forwarding Confirmation", "Confirmation code:&nbsp;555666777", null)).toBe("555666777");
    expect(gmailCode("Gmail Forwarding Confirmation", "Confirmation code 555666777", null)).toBe("555666777");
  });
  it("holds mail not forwarded by the owner's Gmail, and keeps nothing from it", async () => {
    const d = await decideInbound(eml({ from: "Spammer <x@evil.test>", subject: "Invoice", id: "s1", pdf: true }), { from: "x@evil.test", to: TO }, settings, admins);
    expect(d.kind).toBe("held");
    expect("file" in d).toBe(false);
  });
  it("holds a forward whose SPF check failed", async () => {
    const d = await decideInbound(eml({ from: "Cloudflare <noreply@notify.cloudflare.com>", subject: "Invoice", id: "s2", extra: "Received-SPF: fail (domain does not designate)" }), { from: GMAIL_FWD, to: TO }, settings, admins);
    expect(d.kind).toBe("held");
  });
  it("takes the PDF from an auto-forwarded receipt", async () => {
    const d = await decideInbound(eml({ from: "Cloudflare <noreply@notify.cloudflare.com>", subject: "Your invoice", id: "r1", pdf: true }), { from: GMAIL_FWD, to: TO }, settings, admins);
    expect(d).toMatchObject({ kind: "receipt", fromAddress: "noreply@notify.cloudflare.com", file: { name: "invoice.pdf", type: "application/pdf" } });
  });
  it("keeps the email itself when the receipt is the email", async () => {
    const d = await decideInbound(eml({ from: "Apple <no_reply@email.apple.com>", subject: "Your receipt from Apple", id: "r2", html: "<p>Total <b>£2.99</b></p>" }), { from: GMAIL_FWD, to: TO }, settings, admins);
    if (d.kind !== "receipt" || !d.file) throw new Error("expected a receipt with a file");
    expect(d.file.type).toBe("text/html");
    expect(new TextDecoder().decode(d.file.body)).toContain("£2.99");
  });
  it("uses the original sender when the owner forwarded it by hand", async () => {
    const text = "---------- Forwarded message ---------\nFrom: Adobe <message@adobe.com>\nDate: 1 Oct 2026\nSubject: Your invoice";
    const d = await decideInbound(eml({ from: "Owner <owner@gmail.com>", subject: "Fwd: Your invoice", id: "r3", text, pdf: true }), { from: "owner@gmail.com", to: TO }, settings, admins);
    expect(d).toMatchObject({ kind: "receipt", fromAddress: "message@adobe.com", fromName: "Adobe" });
  });
});

describe("receipts arriving in the books", () => {
  let repo: PlatformRepository;
  beforeEach(async () => {
    ({ db } = createTestDb());
    files.clear();
    reading.mockReset();
    repo = new PlatformRepository(db);
    await repo.upsertFinanceSettings({ receiptInboxToken: TOKEN });
  });
  const addLine = (v: Partial<{ date: string; description: string; counterparty: string; amountMinor: number }>) => repo.insertFinanceTransaction({
    date: "2026-10-01", category: "cloud_infrastructure", description: "Workers paid plan", counterparty: "Cloudflare", amountMinor: 5_00, vatMinor: null, currency: "GBP",
    source: "manual", externalId: null, receiptRef: null, notes: null, ...v,
  });

  it("reads a forwarded receipt and attaches it to its line by itself; the same email twice is kept once", async () => {
    const tx = await addLine({});
    reading.mockResolvedValue({ isReceipt: true, supplier: "Cloudflare", date: "2026-10-02", totalMinor: 5_00, vatMinor: null, currency: "GBP", summary: "Workers", category: "cloud_infrastructure" });
    const raw = eml({ from: "Cloudflare <noreply@notify.cloudflare.com>", subject: "Your invoice", id: "cf-1", pdf: true });
    expect(await ingestInbound(repo, raw, { from: GMAIL_FWD, to: TO }, "key")).toBe("kept");
    const [row] = await repo.listReceiptInbox();
    expect(row).toMatchObject({ status: "matched", transactionId: tx.id, supplier: "Cloudflare", totalMinor: 5_00 });
    expect((await repo.findFinanceTransaction(tx.id))?.receiptKey).toBe(row!.fileKey);
    expect(await ingestInbound(repo, raw, { from: GMAIL_FWD, to: TO }, "key")).toBe("duplicate");
  });

  it("leaves an uncertain one waiting; adding the line later attaches it", async () => {
    reading.mockResolvedValue({ isReceipt: true, supplier: "Adobe", date: "2026-10-03", totalMinor: 12_00, vatMinor: 2_00, currency: "GBP", summary: "Acrobat", category: "software_ai" });
    await ingestInbound(repo, eml({ from: "Adobe <message@adobe.com>", subject: "Invoice", id: "ad-1", pdf: true }), { from: GMAIL_FWD, to: TO }, "key");
    expect((await repo.listReceiptInbox())[0]).toMatchObject({ status: "pending", readStatus: "read" });
    const fd = new FormData();
    for (const [k, v] of Object.entries({ date: "2026-10-03", category: "software_ai", description: "Acrobat", counterparty: "Adobe", amount: "12.00", currency: "GBP" })) fd.set(k, v);
    expect(await addTransactionAction({ ok: false }, fd)).toMatchObject({ ok: true, message: expect.stringContaining("waiting receipt was attached") });
    expect((await repo.listReceiptInbox())[0]).toMatchObject({ status: "matched" });
  });

  it("a receipt from the inbox goes back to the inbox when its line is deleted; its file stays", async () => {
    const tx = await addLine({});
    reading.mockResolvedValue({ isReceipt: true, supplier: "Cloudflare", date: "2026-10-01", totalMinor: 5_00, vatMinor: null, currency: "GBP", summary: null, category: null });
    await ingestInbound(repo, eml({ from: "Cloudflare <noreply@notify.cloudflare.com>", subject: "Invoice", id: "cf-2", pdf: true }), { from: GMAIL_FWD, to: TO }, "key");
    const key = (await repo.listReceiptInbox())[0]!.fileKey!;
    expect(await deleteTransactionAction(tx.id)).toMatchObject({ ok: true });
    expect((await repo.listReceiptInbox())[0]).toMatchObject({ status: "pending", transactionId: null });
    expect(files.has(key)).toBe(true);
  });

  it("stores nothing from a held message, and doesn't read it", async () => {
    expect(await ingestInbound(repo, eml({ from: "x@evil.test", subject: "Invoice", id: "ev-1", pdf: true }), { from: "x@evil.test", to: TO }, "key")).toBe("held");
    expect(files.size).toBe(0);
    expect(reading).not.toHaveBeenCalled();
  });
});
