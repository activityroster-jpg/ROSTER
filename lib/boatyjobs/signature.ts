/**
 * Boaty Jobs webhooks are signed: X-BoatyJobs-Signature is the HMAC-SHA256 of
 * the raw request body, keyed with BOATYJOBS_PARTNER_SECRET, as lowercase hex
 * (a "sha256=" prefix is accepted). Web Crypto, so it runs on Workers.
 */
function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signBody(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Constant-time check of the signature header against the raw body. No secret or no header → false. */
export async function verifySignature(secret: string | undefined, rawBody: string, header: string | null): Promise<boolean> {
  if (!secret || !header) return false;
  const given = header.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  return same(given, await signBody(secret, rawBody));
}
