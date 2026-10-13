import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { sniffDocumentType } from "@/lib/security/file-type";
import { idSchema } from "@/lib/validation/actions";
import { releaseReceipt } from "@/lib/finance/receipt-inbox";
import { RECEIPT_MAX_BYTES, getReceipt, putReceipt, receiptResponse, safeReceiptName } from "@/lib/finance/receipts";

export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

async function load(rawId: unknown) {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return null;
  const repo = new PlatformRepository(await getDb());
  const row = await repo.findFinanceTransaction(id.data);
  return row ? { repo, row } : null;
}

/** Open a line's receipt (Dev Center finance only). */
export async function GET(req: Request) {
  await requirePlatformAdmin();
  const found = await load(new URL(req.url).searchParams.get("id"));
  if (!found?.row.receiptKey) return notFound();
  return receiptResponse(await getReceipt(found.row.receiptKey), found.row.receiptName ?? "receipt");
}

/**
 * Attach a receipt (PDF or photo) to a line, replacing any earlier one. The
 * file's type is read from its bytes, never from the browser's claim, and the
 * storage key is built from the line's id.
 */
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const form = await req.formData().catch(() => null);
  const found = await load(form?.get("id"));
  if (!found) return notFound();
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
  if (file.size > RECEIPT_MAX_BYTES) return NextResponse.json({ error: "That file is too big (10 MB at most)." }, { status: 413 });
  const body = await file.arrayBuffer();
  const contentType = sniffDocumentType(body);
  if (!contentType) return NextResponse.json({ error: "Send a PDF or a photo (PNG, JPEG or WebP). iPhone HEIC photos: share as JPEG first." }, { status: 415 });

  const { repo, row } = found;
  const name = safeReceiptName(file.name);
  const key = await putReceipt(row.id, name, contentType, body);
  await repo.updateFinanceTransaction(row.id, { receiptKey: key, receiptName: name, receiptType: contentType });
  if (row.receiptKey && row.receiptKey !== key) await releaseReceipt(repo, row.receiptKey);
  return NextResponse.json({ ok: true, receipt: { name, type: contentType } });
}

/** Take a line's receipt off (one that came by email goes back to the inbox). */
export async function DELETE(req: Request) {
  await requirePlatformAdmin();
  const found = await load(new URL(req.url).searchParams.get("id"));
  if (!found) return notFound();
  const { repo, row } = found;
  await repo.updateFinanceTransaction(row.id, { receiptKey: null, receiptName: null, receiptType: null });
  await releaseReceipt(repo, row.receiptKey);
  return NextResponse.json({ ok: true });
}
