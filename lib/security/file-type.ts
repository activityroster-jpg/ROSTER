/**
 * Detect a document's real type from its first bytes, never from the client's
 * declared MIME type or filename. Only the formats we accept for certificates
 * and vetting documents are recognised; anything else is rejected upstream.
 */
export type DocumentMime = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

export const ALLOWED_DOCUMENT_TYPES: ReadonlySet<string> = new Set<DocumentMime>(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function sniffDocumentType(buf: ArrayBuffer | Uint8Array): DocumentMime | null {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
