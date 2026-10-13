import PostalMime, { type Email } from "postal-mime";
import { sniffDocumentType } from "@/lib/security/file-type";
import type { FinanceReceiptInbox, FinanceSettings } from "@/lib/db/schema";
import type { PlatformRepository } from "@/lib/db/repositories/platform";
import { platformAdminEmails } from "@/lib/platform/admin";
import { apexDomain } from "@/lib/config";
import { deleteReceipt, getReceipt, putInboxFile, RECEIPT_MAX_BYTES } from "./receipts";
import { readReceipt } from "./receipt-reader";
import { matchReceipt, senderDomain, type LineFacts } from "./receipt-match";

/**
 * Receipts emailed in. The owner's Gmail filter forwards receipts to a private
 * address (receipts-<token>@<apex>); Cloudflare Email Routing hands each
 * message to workers/mail-in, which posts it to /api/finance/inbound. Here it is
 * checked (right address, forwarded by the allowed Gmail account), the receipt
 * is picked out (a PDF or photo attachment, else the email itself), stored
 * privately, read by Claude, and attached to the matching line in the books
 * when the match is certain. Everything else waits in the Receipt inbox.
 */

export const GMAIL_FORWARDING_SENDER = "forwarding-noreply@google.com";

export function inboxDomain(): string {
  return apexDomain();
}

export function inboxAddress(token: string): string {
  return `receipts-${token}@${inboxDomain()}`;
}

export function newInboxToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Give the books a forwarding address if they have none yet. */
export async function ensureInboxToken(repo: PlatformRepository): Promise<string> {
  const settings = await repo.getFinanceSettings();
  if (settings.receiptInboxToken) return settings.receiptInboxToken;
  const token = newInboxToken();
  await repo.upsertFinanceSettings({ receiptInboxToken: token });
  return token;
}

/** One mailbox, however Gmail spells it: lower case, no +tag, and no dots for Gmail. */
export function mailboxOf(address: string | null | undefined): string {
  const [local = "", domain = ""] = (address ?? "").trim().toLowerCase().split("@");
  const bare = local.split("+")[0]!;
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return `${gmail ? bare.replace(/\./g, "") : bare}@${gmail ? "gmail.com" : domain}`;
}

export function allowedForwarders(settings: Pick<FinanceSettings, "receiptForwardFrom">, admins: Iterable<string>): string[] {
  const list = settings.receiptForwardFrom?.trim() ? [settings.receiptForwardFrom] : [...admins];
  return list.map(mailboxOf);
}

export interface InboundFile { name: string; type: string; body: ArrayBuffer }

export type InboundDecision =
  | { kind: "unknown_address" }
  | { kind: "gmail"; messageId: string; subject: string | null; code: string | null; file: InboundFile | null }
  | { kind: "held"; messageId: string; fromAddress: string | null; fromName: string | null; subject: string | null; reason: string }
  | { kind: "receipt"; messageId: string; fromAddress: string | null; fromName: string | null; subject: string | null; file: InboundFile | null };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function asBuffer(content: ArrayBuffer | Uint8Array | string): ArrayBuffer {
  if (typeof content === "string") return new TextEncoder().encode(content).buffer as ArrayBuffer;
  if (content instanceof Uint8Array) return content.slice().buffer as ArrayBuffer;
  return content;
}

/**
 * The receipt in an email: a PDF attachment first, then a photo (skipping the
 * small inline pictures that are logos), else the email itself as a page.
 */
export function pickReceiptFile(email: Email): InboundFile | null {
  const found: InboundFile[] = [];
  for (const a of email.attachments) {
    if (a.related) continue; // pictures inside the email's own layout
    const body = asBuffer(a.content);
    if (body.byteLength > RECEIPT_MAX_BYTES) continue;
    const type = sniffDocumentType(body);
    if (!type) continue;
    if (type !== "application/pdf" && body.byteLength < 15_000) continue;
    found.push({ name: a.filename || (type === "application/pdf" ? "receipt.pdf" : `receipt.${type.split("/")[1]}`), type, body });
  }
  const pdf = found.find((f) => f.type === "application/pdf");
  if (pdf ?? found[0]) return pdf ?? found[0]!;
  const header = `<div style="font:13px/1.4 sans-serif;color:#555;border-bottom:1px solid #ddd;padding:8px 0;margin-bottom:12px">`
    + `<b>${esc(email.subject ?? "(no subject)")}</b><br>From ${esc(email.from?.name || "")} ${esc(email.from?.address ? `<${email.from.address}>` : "")}${email.date ? ` · ${esc(email.date)}` : ""}</div>`;
  const page = email.html
    ? `<!doctype html><meta charset="utf-8">${header}${email.html}`
    : email.text
      ? `<!doctype html><meta charset="utf-8">${header}<pre style="white-space:pre-wrap;font:14px/1.5 sans-serif">${esc(email.text)}</pre>`
      : null;
  if (!page) return null;
  const body = new TextEncoder().encode(page).buffer as ArrayBuffer;
  return body.byteLength > RECEIPT_MAX_BYTES ? null : { name: "email.html", type: "text/html", body };
}

/** When the owner forwarded a receipt by hand, the supplier is in the "From:" line of the forwarded part. */
export function forwardedSender(email: Email): { address: string; name: string | null } | null {
  const text = email.text ?? email.html?.replace(/<[^>]+>/g, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ?? "";
  const m = /^\s*From:\s*(?:"?([^"<\n]*?)"?\s*)?<([^>\s]+@[^>\s]+)>/m.exec(text) ?? /^\s*From:\s*([^\s<>]+@[^\s<>]+)/m.exec(text);
  if (!m) return null;
  return m[2] ? { address: m[2].toLowerCase(), name: m[1]?.trim() || null } : { address: m[1]!.toLowerCase(), name: null };
}

/** An SPF check the receiving server recorded as failed (absent or passed is fine). */
function spfFailed(email: Email): boolean {
  const h = email.headers.find((x) => x.key === "received-spf")?.value.trim().toLowerCase() ?? "";
  return h.startsWith("fail") || h.startsWith("softfail");
}

/**
 * Decide what an inbound message is, without storing anything. `envelope.from`
 * is the address the message was delivered from: for a Gmail auto-forward it is
 * the forwarding account itself (with a +caf_ tag), which is what we check.
 */
export async function decideInbound(raw: ArrayBuffer, envelope: { from: string; to: string }, settings: Pick<FinanceSettings, "receiptInboxToken" | "receiptForwardFrom">, admins: Iterable<string>): Promise<InboundDecision> {
  const token = settings.receiptInboxToken;
  const to = envelope.to.trim().toLowerCase();
  if (!token || to.split("@")[0] !== `receipts-${token}`) return { kind: "unknown_address" };

  const email = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
  const subject = email.subject?.slice(0, 300) ?? null;
  const fromAddress = email.from?.address?.toLowerCase() ?? null;
  const fromName = email.from?.name?.slice(0, 200) || null;
  const messageId = (email.messageId?.trim() || `no-id:${envelope.from}:${email.date ?? ""}:${subject ?? ""}`).slice(0, 500);

  if (mailboxOf(envelope.from) === GMAIL_FORWARDING_SENDER || fromAddress === GMAIL_FORWARDING_SENDER) {
    const body = `${subject ?? ""}\n${email.text ?? email.html ?? ""}`;
    const code = /confirmation code:\s*(\d{6,12})/i.exec(body)?.[1] ?? /\((?:#)?(\d{6,12})\)/.exec(subject ?? "")?.[1] ?? null;
    return { kind: "gmail", messageId, subject, code, file: pickReceiptFile(email) };
  }

  const forwarders = allowedForwarders(settings, admins);
  if (!forwarders.includes(mailboxOf(envelope.from)) || spfFailed(email)) {
    return { kind: "held", messageId, fromAddress, fromName, subject, reason: `Sent from ${envelope.from}, not your forwarding Gmail address` };
  }

  // Forwarded by hand: the supplier is the original sender, not the owner.
  let sender = { address: fromAddress, name: fromName };
  if (fromAddress && forwarders.includes(mailboxOf(fromAddress))) {
    const original = forwardedSender(email);
    if (original) sender = { address: original.address, name: original.name };
  }
  return { kind: "receipt", messageId, fromAddress: sender.address, fromName: sender.name, subject, file: pickReceiptFile(email) };
}

export type IngestResult = "unknown_address" | "duplicate" | "kept" | "held" | "gmail";

/** Store an inbound message and, for a receipt, read and match it. */
export async function ingestInbound(repo: PlatformRepository, raw: ArrayBuffer, envelope: { from: string; to: string }, apiKey: string | undefined): Promise<IngestResult> {
  const settings = await repo.getFinanceSettings();
  const d = await decideInbound(raw, envelope, settings, platformAdminEmails());
  if (d.kind === "unknown_address") return "unknown_address";
  const id = crypto.randomUUID();
  if (d.kind === "gmail") {
    const row = await repo.insertReceiptInbox({ id, messageId: d.messageId, status: "gmail", subject: d.subject, fromAddress: GMAIL_FORWARDING_SENDER, note: d.code });
    if (!row) return "duplicate";
    // Kept so the owner can open it if the code couldn't be picked out (it also has Google's confirm link).
    if (d.file) await repo.updateReceiptInbox(id, { fileKey: await putInboxFile(id, d.file.name, d.file.type, d.file.body), fileName: d.file.name, fileType: d.file.type });
    return "gmail";
  }
  if (d.kind === "held") {
    // Nothing from an unknown sender is stored or read: just a note that it came.
    const row = await repo.insertReceiptInbox({ id, messageId: d.messageId, status: "held", fromAddress: d.fromAddress, fromName: d.fromName, subject: d.subject, note: d.reason });
    return row ? "held" : "duplicate";
  }
  const row = await repo.insertReceiptInbox({
    id, messageId: d.messageId, status: "pending", fromAddress: d.fromAddress, fromName: d.fromName, subject: d.subject,
    note: d.file ? null : "No receipt found in this email",
  });
  if (!row) return "duplicate";
  if (d.file) {
    const key = await putInboxFile(id, d.file.name, d.file.type, d.file.body);
    await repo.updateReceiptInbox(id, { fileKey: key, fileName: d.file.name, fileType: d.file.type });
    await readAndMatch(repo, id, apiKey);
  }
  return "kept";
}

/** Read a kept receipt with Claude, then attach it if exactly one line clearly matches. */
export async function readAndMatch(repo: PlatformRepository, inboxId: string, apiKey: string | undefined): Promise<FinanceReceiptInbox | null> {
  const row = await repo.findReceiptInbox(inboxId);
  if (!row?.fileKey || !row.fileType) return row;
  if (!apiKey) return repo.updateReceiptInbox(row.id, { readStatus: "failed", note: "Reading is switched off (no Anthropic key set). Match it by hand." });
  try {
    const object = await getReceipt(row.fileKey);
    if (!object) return repo.updateReceiptInbox(row.id, { readStatus: "failed", note: "The stored file is missing" });
    const reading = await readReceipt({ fileType: row.fileType, body: await object.arrayBuffer(), subject: row.subject, fromAddress: row.fromAddress }, apiKey);
    if (!reading) return repo.updateReceiptInbox(row.id, { readStatus: "failed", note: "Couldn't read this one. Match it by hand." });
    await repo.updateReceiptInbox(row.id, {
      readStatus: "read", supplier: reading.supplier, receiptDate: reading.date, totalMinor: reading.totalMinor, vatMinor: reading.vatMinor,
      currency: reading.currency, summary: reading.summary, suggestedCategory: reading.category,
      note: reading.isReceipt ? null : "This doesn't look like a receipt",
    });
  } catch (err) {
    console.error("[receipts] reading failed:", (err as Error).message);
    return repo.updateReceiptInbox(row.id, { readStatus: "failed", note: "Couldn't read this one just now. Try Read again, or match it by hand." });
  }
  const read = await repo.findReceiptInbox(row.id);
  if (!read) return null;
  const auto = await autoMatch(repo, read);
  return auto ?? read;
}

const lineFacts = (rows: Awaited<ReturnType<PlatformRepository["listFinanceTransactions"]>>): LineFacts[] =>
  rows.map((t) => ({ id: t.id, date: t.date, amountMinor: t.amountMinor, currency: t.currency, counterparty: t.counterparty, description: t.description, hasReceipt: Boolean(t.receiptKey) }));

/** Sender domain → the supplier names its earlier receipts were matched to. */
export async function knownSuppliers(repo: PlatformRepository, lines?: Awaited<ReturnType<PlatformRepository["listFinanceTransactions"]>>): Promise<Map<string, string[]>> {
  const all = lines ?? (await repo.listFinanceTransactions());
  const byId = new Map(all.map((t) => [t.id, t]));
  const known = new Map<string, string[]>();
  for (const r of await repo.listReceiptInboxByStatus("matched", 500)) {
    const domain = senderDomain(r.fromAddress);
    const tx = r.transactionId ? byId.get(r.transactionId) : undefined;
    if (!domain || !tx) continue;
    const names = known.get(domain) ?? [];
    for (const n of [tx.counterparty, r.supplier]) if (n && !names.includes(n)) names.push(n);
    known.set(domain, names);
  }
  return known;
}

/** Attach a read receipt to its line when the match is certain. Returns the updated row, or null when left for the owner. */
export async function autoMatch(repo: PlatformRepository, row: FinanceReceiptInbox, onlyLines?: ReadonlySet<string>): Promise<FinanceReceiptInbox | null> {
  if (row.status !== "pending" || row.totalMinor == null || !row.currency || !row.fileKey) return null;
  const lines = await repo.listFinanceTransactions();
  const result = matchReceipt(
    { totalMinor: row.totalMinor, currency: row.currency, date: row.receiptDate ?? row.createdAt.toISOString().slice(0, 10), supplier: row.supplier, fromAddress: row.fromAddress },
    lineFacts(lines),
    await knownSuppliers(repo, lines),
  );
  if (!result.auto || (onlyLines && !onlyLines.has(result.auto))) return null;
  return attachInboxToLine(repo, row, result.auto);
}

/** After lines are added by hand, attach any waiting receipt that now clearly matches one of them. */
export async function matchWaitingReceipts(repo: PlatformRepository, newLineIds: string[]): Promise<number> {
  if (newLineIds.length === 0) return 0;
  const only = new Set(newLineIds);
  let attached = 0;
  for (const row of await repo.listReceiptInboxByStatus("pending")) {
    if (row.readStatus !== "read") continue;
    if (await autoMatch(repo, row, only)) attached++;
  }
  return attached;
}

/**
 * Take a receipt file off a line. A receipt that came from the inbox goes back
 * there to be matched again; one uploaded by hand is deleted.
 */
export async function releaseReceipt(repo: PlatformRepository, key: string | null | undefined): Promise<void> {
  if (!key) return;
  const fromInbox = await repo.findReceiptInboxByFile(key);
  if (fromInbox) await repo.updateReceiptInbox(fromInbox.id, { status: "pending", transactionId: null });
  else await deleteReceipt(key);
}

export async function attachInboxToLine(repo: PlatformRepository, row: FinanceReceiptInbox, txId: string): Promise<FinanceReceiptInbox | null> {
  if (!row.fileKey) return null;
  const tx = await repo.findFinanceTransaction(txId);
  if (!tx) return null;
  if (tx.receiptKey && tx.receiptKey !== row.fileKey) await releaseReceipt(repo, tx.receiptKey);
  await repo.updateFinanceTransaction(tx.id, { receiptKey: row.fileKey, receiptName: row.fileName ?? "receipt", receiptType: row.fileType });
  return repo.updateReceiptInbox(row.id, { status: "matched", transactionId: tx.id });
}
