/**
 * Password strength for the meter shown wherever a password is created. Pure
 * and client-safe. The server rule is 8+ characters with a letter and a number
 * plus the breached-password check; the meter encourages more than the minimum.
 */
export interface StrengthResult {
  /** 0 = too short/invalid, 1 weak, 2 fair, 3 good, 4 strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  meetsRule: boolean;
  checks: { length: boolean; letter: boolean; number: boolean; mixed: boolean; long: boolean };
}

const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwerty123", "letmein1", "welcome1", "sailing1", "iloveyou1", "abcd1234", "11111111", "football1", "sunshine1"]);

export function passwordStrength(pw: string): StrengthResult {
  const length = pw.length >= 8;
  const letter = /[A-Za-z]/.test(pw);
  const number = /\d/.test(pw);
  const mixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw) || /[^A-Za-z0-9]/.test(pw);
  const long = pw.length >= 12;
  const meetsRule = length && letter && number;
  let score = 0;
  if (meetsRule) score = 1;
  if (meetsRule && (mixed || long)) score = 2;
  if (meetsRule && mixed && long) score = 3;
  if (meetsRule && mixed && pw.length >= 16) score = 4;
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw) || /^(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(pw) && pw.length < 12) score = Math.min(score, 1) as 0 | 1;
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score]!;
  return { score: score as StrengthResult["score"], label, meetsRule, checks: { length, letter, number, mixed, long } };
}
