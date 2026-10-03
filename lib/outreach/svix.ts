/**
 * Verify a Resend (Svix) webhook signature without a dependency:
 * HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>" with the secret
 * after "whsec_" (base64), compared to each "v1,<base64>" entry in svix-signature.
 */
const enc = new TextEncoder();
const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

export async function verifySvix(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, rawBody: string, nowS = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > 5 * 60) return false;
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    const decoded = atob(raw);
    keyBytes = new Uint8Array(new ArrayBuffer(decoded.length));
    for (let i = 0; i < decoded.length; i++) keyBytes[i] = decoded.charCodeAt(i);
  } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", key, enc.encode(`${headers.id}.${headers.timestamp}.${rawBody}`)));
  const candidates = headers.signature.split(/\s+/).map((s) => s.split(",")[1] ?? "");
  return candidates.some((c) => c.length === expected.length && timingSafeEqual(c, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
