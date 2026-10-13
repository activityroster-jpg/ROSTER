import { getEnv } from "@/lib/cf/bindings";

/**
 * Receipts (a photo or a PDF) attached to lines in the owner's books. The books
 * are platform data, not a centre's, so receipts live under their own fixed
 * prefix in the private documents bucket, never inside a centre's `org_` space.
 * Keys are built here from the transaction id, never taken from a request.
 */
export const RECEIPT_PREFIX = "platform/finance-receipts/";
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export const safeReceiptName = (name: string) => name.replace(/[^A-Za-z0-9._ -]/g, "").trim().slice(0, 80) || "receipt";

export function isReceiptKey(key: string): boolean {
  return key.startsWith(RECEIPT_PREFIX) && !key.includes("..");
}

export async function putReceipt(txId: string, filename: string, contentType: string, body: ArrayBuffer): Promise<string> {
  const key = `${RECEIPT_PREFIX}${txId}/${Date.now()}-${safeReceiptName(filename)}`;
  await getEnv().DOCS.put(key, body, { httpMetadata: { contentType } });
  return key;
}

export async function getReceipt(key: string): Promise<R2ObjectBody | null> {
  if (!isReceiptKey(key)) return null;
  return getEnv().DOCS.get(key);
}

/** Remove a stored receipt. Never throws: a missing file is already gone. */
export async function deleteReceipt(key: string | null | undefined): Promise<void> {
  if (!key || !isReceiptKey(key)) return;
  await getEnv().DOCS.delete(key).catch(() => {});
}

/** Serve a receipt privately: PDFs and images open in the browser, never cached, never sniffed. */
export function receiptResponse(object: R2ObjectBody | null, name: string): Response {
  if (!object) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  const type = object.httpMetadata?.contentType ?? "";
  const inline = INLINE_TYPES.has(type);
  const filename = safeReceiptName(name).replace(/"/g, "");
  return new Response(object.body, {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
