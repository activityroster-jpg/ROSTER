import { escapeHtml } from "./index";

/**
 * Every one-time-code email in one shape (decided 5 Oct): sign-in and
 * verification codes lead the subject ("123456 is your ActivityRoster sign-in
 * code"); reset codes (PIN, password) stay out of it, since lock screens show
 * subjects. The first line is one plain sentence with the code in it, which is
 * what mail apps (and Gmail's "Copy code" card) look for, and a plain-text
 * copy goes with it. Anything else about the request comes after it.
 */
export function codeEmailHtml(input: { label: string; code: string; details?: string[]; footnote: string }): string {
  const code = escapeHtml(input.code);
  const details = (input.details ?? []).map((d) => `<p>${d}</p>`).join("");
  return `<p>Your ActivityRoster ${escapeHtml(input.label)} is <span style="font-size:26px;font-weight:700;letter-spacing:3px;white-space:nowrap;color:#0f172a">${code}</span></p>${details}<p style="color:#64748b;font-size:12px">${input.footnote}</p>`;
}
