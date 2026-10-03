/** "conor@example.com" → "c****@example.com": enough to recognise, never the whole address. */
export function maskEmail(e: string): string {
  return e.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => `${a}${"*".repeat(Math.min(b.length, 6))}${c}`);
}
