/** Light email validation that works on Workers: syntax + the domain accepts mail (MX, or an A record as fallback). */
const SYNTAX = /^[A-Z0-9._%+-]+@([A-Z0-9-]+\.)+[A-Z]{2,}$/i;

export async function emailLooksDeliverable(email: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; reason: string }> {
  const e = email.trim().toLowerCase();
  if (!SYNTAX.test(e)) return { ok: false, reason: "Not a valid address" };
  const domain = e.split("@")[1]!;
  const lookup = async (type: "MX" | "A") => {
    try {
      const res = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: "application/dns-json" } });
      if (!res.ok) return null;
      const j = (await res.json()) as { Status?: number; Answer?: { type: number }[] };
      return (j.Answer ?? []).length > 0;
    } catch { return null; }
  };
  const mx = await lookup("MX");
  if (mx === true) return { ok: true, reason: "Domain accepts mail" };
  if (mx === null) return { ok: true, reason: "Could not check the domain (assumed fine)" };
  const a = await lookup("A");
  return a ? { ok: true, reason: "Domain exists (no MX record)" } : { ok: false, reason: "Domain does not accept mail" };
}
