"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { idSchema } from "@/lib/validation/actions";
import { attachInboxToLine, forwardList, readAndMatch } from "@/lib/finance/receipt-inbox";
import { deleteReceipt } from "@/lib/finance/receipts";
import type { FinanceResult } from "./actions";

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const done = (r: FinanceResult): FinanceResult => { revalidatePath("/admin/finance"); return r; };

/** Attach a waiting receipt to the line the owner picked. */
export async function attachInboxAction(inboxId: string, txId: string): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(inboxId).success || !idSchema.safeParse(txId).success) return { ok: false, error: "Not found" };
  const row = await p.findReceiptInbox(inboxId);
  if (!row || row.status !== "pending" || !row.fileKey) return { ok: false, error: "That receipt isn't waiting any more" };
  const out = await attachInboxToLine(p, row, txId);
  return done(out ? { ok: true, message: "Receipt attached" } : { ok: false, error: "That line is gone" });
}

/** Read a receipt again (after a failed read, or once the Anthropic key is set). */
export async function rereadInboxAction(inboxId: string): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(inboxId).success) return { ok: false, error: "Not found" };
  const row = await readAndMatch(p, inboxId, getEnv().ANTHROPIC_API_KEY);
  if (!row) return { ok: false, error: "Not found" };
  return done({ ok: row.readStatus === "read", message: row.status === "matched" ? "Read and attached" : "Read", error: row.note ?? "Couldn't read it" });
}

/** Not a receipt, or not wanted in the books: set aside (can be brought back). */
export async function dismissInboxAction(inboxId: string, back = false): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(inboxId).success) return { ok: false, error: "Not found" };
  const row = await p.findReceiptInbox(inboxId);
  if (!row || row.status === "matched") return { ok: false, error: "Not found" };
  await p.updateReceiptInbox(row.id, { status: back ? "pending" : "dismissed" });
  return done({ ok: true, message: back ? "Back in the inbox" : "Set aside" });
}

/** Delete a set-aside, held or Gmail-code item, and its file. Attached receipts stay with their line. */
export async function deleteInboxAction(inboxId: string): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(inboxId).success) return { ok: false, error: "Not found" };
  const row = await p.findReceiptInbox(inboxId);
  if (!row || row.status === "matched" || row.status === "pending") return { ok: false, error: "Set it aside first" };
  await deleteReceipt(row.fileKey);
  await p.deleteReceiptInbox(row.id);
  return done({ ok: true, message: "Deleted" });
}

const forwardSchema = z.array(z.string().email().max(200)).max(10);

/** Which addresses may forward receipts in, comma-separated, up to ten (blank = the platform admins' addresses). */
export async function saveForwardingAction(_prev: FinanceResult, fd: FormData): Promise<FinanceResult> {
  const p = await platform();
  const raw = fd.get("forwardFrom");
  const parsed = forwardSchema.safeParse(forwardList(typeof raw === "string" ? raw : ""));
  if (!parsed.success) return { ok: false, error: "Enter up to ten email addresses, separated by commas, or leave it blank" };
  const list = [...new Set(parsed.data)];
  await p.upsertFinanceSettings({ receiptForwardFrom: list.length ? list.join(", ") : null });
  return done({ ok: true, message: "Saved" });
}
