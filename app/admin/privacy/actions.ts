"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PRIVACY_REQUEST_STATUSES, type PrivacyRequestStatus } from "@/lib/db/schema";
import { idSchema } from "@/lib/validation/actions";
import { z } from "zod";
import { getRepositories } from "@/lib/cf/bindings";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { recordSecurityEvent } from "@/lib/security/events";
import { SUBPROCESSOR_CHANGES } from "@/lib/legal/subprocessors";

export async function setPrivacyRequestStatusAction(id: string, status: string, notes?: string): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin();
  const pid = idSchema.safeParse(id);
  if (!pid.success || !(PRIVACY_REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid request" };
  const repo = new PlatformRepository(await getDb());
  await repo.setPrivacyRequestStatus(pid.data, status as PrivacyRequestStatus, notes === undefined ? undefined : String(notes).slice(0, 2000));
  revalidatePath("/admin/privacy");
  return { ok: true };
}

const noticeSchema = z.object({
  summary: z.string().trim().min(20, "Say what is changing in at least a sentence.").max(2000),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date the change takes effect."),
  test: z.boolean().default(false),
});

/**
 * Sub-processor change notice (compliance P1-G): one email to every admin of
 * every active or suspended centre, at least 30 days before a new or changed
 * sub-processor handles their data, pointing at /subprocessors. Queued through
 * the normal email queue (so it retries and shows in Dev Center → Email) and
 * recorded as a security event against the owner. `test` sends only to the
 * owner so the wording can be checked first.
 */
export async function sendSubprocessorNoticeAction(input: { summary: string; effectiveOn: string; test?: boolean }): Promise<{ ok: boolean; error?: string; message?: string }> {
  const { email: owner } = await requirePlatformAdmin();
  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the notice" };
  const { summary, effectiveOn, test } = parsed.data;
  const effective = new Date(`${effectiveOn}T12:00:00Z`);
  const daysAhead = Math.floor((effective.getTime() - Date.now()) / 86_400_000);
  if (!test && daysAhead < 30) return { ok: false, error: `The effective date is only ${daysAhead} day${daysAhead === 1 ? "" : "s"} away; centres get at least 30 days' notice.` };
  const latest = SUBPROCESSOR_CHANGES[0];
  if (!test && (!latest || latest.date > effectiveOn)) return { ok: false, error: "Add the change to lib/legal/subprocessors.ts first so the public page shows it; the notice links there." };

  const { control } = await getRepositories();
  const repo = new PlatformRepository(await getDb());
  const orgs = test ? [] : (await repo.listOrganisations()).filter((o) => o.status === "active" || o.status === "suspended");
  const recipients = new Map<string, string[]>(); // email -> centre names
  for (const o of orgs) {
    for (const e of await control.adminEmailsForOrg(o.id)) recipients.set(e, [...(recipients.get(e) ?? []), o.name]);
  }
  if (test) recipients.set(owner, ["(test: your own centres)"]);

  const when = effective.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  let sent = 0;
  for (const [to, centres] of recipients) {
    const html = `<p>Hello,</p>
<p>You are an admin for ${escapeHtml(centres.join(", "))} on ActivityRoster. Under our data processing terms we tell you before a company that handles personal data for us changes. This is that notice.</p>
<p><strong>What is changing, from ${when}:</strong><br>${escapeHtml(summary).replace(/\n/g, "<br>")}</p>
<p>The full list of sub-processors, with every change dated, is at <a href="https://activityroster.com/subprocessors">activityroster.com/subprocessors</a>. If you have a concern, reply to this email before ${when} and we will discuss it with you before the change takes effect; nothing about how your centre's data is used day to day changes.</p>
<p>Kind regards,<br>ActivityRoster</p>`;
    try {
      await sendEmail({ to, subject: `${test ? "[TEST] " : ""}Notice of a change to ActivityRoster's sub-processors (from ${when})`, html, from: undefined });
      sent++;
    } catch (e) {
      console.error("[subprocessor-notice]", to, (e as Error).message);
    }
  }
  const ownerUser = await control.userByEmail(owner);
  if (ownerUser && !test) await recordSecurityEvent("subprocessor_notice", { userId: ownerUser.id, meta: { effectiveOn, recipients: sent, centres: orgs.length, summary: summary.slice(0, 500) } });
  return { ok: true, message: test ? `Test notice queued to ${owner}.` : `Notice queued to ${sent} admin${sent === 1 ? "" : "s"} across ${orgs.length} centre${orgs.length === 1 ? "" : "s"}, effective ${when}. It shows in Email → queue as it goes out.` };
}
