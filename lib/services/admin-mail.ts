import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { apexDomain } from "@/lib/config";

/**
 * Email every active admin of the centre about something that needs them
 * (a leave request, someone offering to cover a shift). Best effort: a mail
 * failure never fails the action that triggered it. Text from users is escaped
 * by callers' templates via escapeHtml here.
 */
export async function emailAdmins(
  repos: Repositories,
  ctx: AnyTenantContext,
  msg: { subject: string; html: string; path: string; cta: string },
): Promise<void> {
  try {
    const admins = await repos.control.adminEmailsForOrg(ctx.organisationId);
    if (admins.length === 0) return;
    const url = `https://${ctx.slug}.${apexDomain()}${msg.path}`;
    const html = `${msg.html}<p><a href="${url}" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(msg.cta)}</a></p>`;
    await Promise.all(admins.map((to) => sendEmail({ to, subject: msg.subject.replace(/[\r\n]+/g, " ").slice(0, 150), html }).catch(() => {})));
  } catch (err) {
    console.error("[admin-mail] failed:", (err as Error).message);
  }
}
