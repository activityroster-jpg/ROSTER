/**
 * SSRF guard for admin-supplied calendar feed URLs. The server fetches these,
 * so we must stop them pointing at loopback, link-local (cloud metadata) or
 * private-network addresses, or non-web schemes. This is a best-effort control:
 * DNS rebinding can't be fully prevented without resolving at fetch time, but it
 * blocks the common and dangerous literal cases.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\.0\.0\.0$/,
  /^127\./, // loopback
  /^10\./, // private
  /^192\.168\./, // private
  /^169\.254\./, // link-local (incl. 169.254.169.254 cloud metadata)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
];

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true; // IPv6 loopback/ULA/link-local
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
}

/** Normalise webcal:// → https:// and reject unsafe URLs. Throws on failure. */
export function assertSafeFeedUrl(raw: string): string {
  const trimmed = (raw ?? "").trim();
  const normalised = trimmed.startsWith("webcal://") ? "https://" + trimmed.slice("webcal://".length) : trimmed;
  let u: URL;
  try {
    u = new URL(normalised);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Feed URL must start with https://");
  if (!u.hostname || isBlockedHost(u.hostname)) throw new Error("That address isn't allowed");
  return u.toString();
}

/** Non-throwing check for form validation. */
export function isSafeFeedUrl(raw: string): boolean {
  try { assertSafeFeedUrl(raw); return true; } catch { return false; }
}
