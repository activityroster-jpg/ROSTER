import { APP_STORES, appStoresLive } from "@/lib/config";
import { escapeHtml } from "./index";

/**
 * The invitation email (audit follow-up, 5 Oct): names the centre and who
 * invited them, says what happens next in three steps, and says what to do if
 * the one-time link has expired. The reminder (one day later, once) has no
 * link in it at all: it sends people to the sign-in page for a fresh one.
 */
export type InviteKind = "instructor" | "office";

export interface InviteEmailInput {
  kind: InviteKind;
  centreName: string;
  inviterName: string | null;
  /** The one-time sign-in link (invites only). */
  url?: string;
  /** The centre's sign-in page, for an expired link or the reminder. */
  signInUrl: string;
  email: string;
}

const STEPS: Record<InviteKind, string[]> = {
  instructor: [
    "Set a password and a 4-digit PIN.",
    "Mark the days you're free, so the office can roster you.",
    "Upload your certificates (first aid, instructor licences or ratings and so on).",
  ],
  office: [
    "Create your account: your name and a password (no account needed beforehand).",
    "Choose a 4-digit PIN. The link in this email already confirms your address, so there is no extra code to type.",
    "Open the office. You'll see the parts your superadmin has ticked for you.",
    "Have a look round the roster and staff list.",
  ],
};

function who(input: InviteEmailInput): string {
  return input.inviterName ? `${input.inviterName} at ${input.centreName}` : input.centreName;
}

/** App Store and Google Play buttons for instructor invites, once the apps are live (lib/config APP_STORES). */
function storeLinks(): string {
  if (!appStoresLive()) return "";
  const btn = (href: string, label: string) => `<a href="${href}" style="display:inline-block;background:#111;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;margin:0 8px 8px 0">${label}</a>`;
  return `<p style="margin:12px 0 4px"><strong>Get the instructor app</strong></p><p>${APP_STORES.ios ? btn(APP_STORES.ios, " App Store") : ""}${APP_STORES.android ? btn(APP_STORES.android, "▶ Google Play") : ""}</p>`;
}

export function inviteEmail(input: InviteEmailInput): { subject: string; html: string } {
  const c = escapeHtml(input.centreName);
  const steps = STEPS[input.kind].map((s) => `<li style="margin:0 0 4px">${escapeHtml(s)}</li>`).join("");
  return {
    subject: `${who(input)} has invited you to ActivityRoster`,
    html: `
      <p>Hello,</p>
      <p>${escapeHtml(who(input))} has invited you to ActivityRoster, the system ${c} uses for ${input.kind === "office" ? "the roster, staff and courses" : "the instructor roster"}.</p>
      <p><a href="${input.url ?? input.signInUrl}" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Accept and create your account</a></p>
      <p style="margin-bottom:4px"><strong>What happens next</strong></p>
      <ol style="margin-top:0;padding-left:20px">${steps}</ol>
      ${input.kind === "instructor" ? storeLinks() : ""}
      <p style="color:#64748b;font-size:12px">The button works once and only for a short while. If it has expired, open <a href="${input.signInUrl}">${escapeHtml(input.signInUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, ""))}</a>, enter ${escapeHtml(input.email)} and choose “Set up your account”.</p>
      <p style="color:#64748b;font-size:12px">Not expecting this? You can ignore it; nothing happens unless you accept.</p>
    `,
  };
}

export function inviteReminderEmail(input: InviteEmailInput): { subject: string; html: string } {
  const steps = STEPS[input.kind].map((s) => `<li style="margin:0 0 4px">${escapeHtml(s)}</li>`).join("");
  return {
    subject: `Reminder: ${who(input)} invited you to ActivityRoster`,
    html: `
      <p>Hello,</p>
      <p>Yesterday ${escapeHtml(who(input))} invited you to ActivityRoster. You haven't signed in yet, so here's how to get started.</p>
      <p><a href="${input.signInUrl}" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Get a sign-in link</a></p>
      <p style="color:#64748b;font-size:12px">Enter ${escapeHtml(input.email)} on that page and we'll email you a fresh link.</p>
      <p style="margin-bottom:4px"><strong>Then</strong></p>
      <ol style="margin-top:0;padding-left:20px">${steps}</ol>
      <p style="color:#64748b;font-size:12px">This is the only reminder we'll send. Not expecting it? You can ignore it.</p>
    `,
  };
}
