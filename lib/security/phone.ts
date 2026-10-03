/**
 * Mobile numbers for the text-message second step. We store E.164 and accept
 * the ways people in the UK and Ireland actually type a number.
 */
export type PhoneCountry = "GB" | "IE";

export function normaliseMobile(raw: string, country: PhoneCountry = "GB"): string | null {
  let s = (raw ?? "").trim().replace(/[\s().-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) {
    const d = s.slice(1);
    return /^\d{8,15}$/.test(d) ? `+${d}` : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith("07") && s.length === 11) return `+44${s.slice(1)}`;      // UK mobile 07xxx xxxxxx
  if (s.startsWith("08") && s.length === 10) return `+353${s.slice(1)}`;     // Irish mobile 08x xxx xxxx
  if (s.startsWith("44") && s.length === 12) return `+${s}`;
  if (s.startsWith("353") && s.length === 12) return `+${s}`;
  if (country === "GB" && s.startsWith("7") && s.length === 10) return `+44${s}`;
  if (country === "IE" && s.startsWith("8") && s.length === 9) return `+353${s}`;
  return null;
}

/** "+447700900123" → "+44 ••• ••• 123" (never show the whole number back). */
export function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  return d.length > 5 ? `+${d.slice(0, 2)} ••• ••• ${d.slice(-3)}` : "•••";
}

export function maskEmail(e: string): string {
  return e.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${"*".repeat(Math.min(b.length, 6))}${c}`);
}
