/**
 * Have I Been Pwned "range" check (k-anonymity): only the first five characters
 * of the password's SHA-1 ever leave the server, and HIBP returns every suffix
 * in that bucket. We never block on an outage — a network error means "unknown",
 * which we treat as not breached so sign-ups keep working.
 */
const RANGE_URL = "https://api.pwnedpasswords.com/range/";

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function pwnedCount(
  password: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<number | null> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let text: string;
    try {
      const res = await fetchImpl(`${RANGE_URL}${prefix}`, { headers: { "Add-Padding": "true", "User-Agent": "ActivityRoster" }, signal: ac.signal });
      if (!res.ok) return null;
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }
    for (const line of text.split(/\r?\n/)) {
      const [sfx, count] = line.trim().split(":");
      if (sfx === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return null;
  }
}

/** True only when HIBP positively reports the password in a breach. */
export async function isPwnedPassword(password: string, fetchImpl?: typeof fetch): Promise<boolean> {
  const n = await pwnedCount(password, fetchImpl);
  return n != null && n > 0;
}

export const PWNED_MESSAGE = "That password has appeared in a known data breach — please choose a different one.";
