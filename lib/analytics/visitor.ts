import { isoDateInTz } from "@/lib/domain/time";

/**
 * The visitor key for telling visits apart: SHA-256 of a salt, the IP and the
 * user agent. The salt is an HMAC of the server secret and today's date, so it
 * changes at midnight and is never stored: yesterday's keys can't be rebuilt,
 * and a key can't be turned back into an IP. Only the key is kept, for 30
 * minutes (visitor_seen).
 */
export async function visitorKey(secret: string, ip: string, ua: string, now: number = Date.now()): Promise<string> {
  const enc = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const salt = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, enc.encode(`traffic:${isoDateInTz(now)}`)));
  const data = new Uint8Array([...salt, ...enc.encode(`|${ip}|${ua}`)]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
