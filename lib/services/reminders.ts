import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { complianceItem as complianceItemTable, notification as notificationTable, qualification as qualificationTable } from "@/lib/db/schema";
import { notifyInstructor } from "./notifications";

/**
 * Cert-expiry reminders, delivered in the app (in-app notification + push).
 * There are no scheduled jobs, so reminders are generated lazily: whenever the
 * instructor opens the portal we look at their certs and raise a reminder for
 * anything expiring inside the centre's lead time (or already expired), at most
 * once every REPEAT_DAYS per cert. Cheap: two scoped reads per visit.
 */
export const REPEAT_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export interface ReminderOutcome { raised: number }

export async function ensureExpiryReminders(repos: Repositories, ctx: AnyTenantContext, instructorId: string, now: number = Date.now()): Promise<ReminderOutcome> {
  const t = repos.tenant;
  const [quals, items, qualTypes, compTypes, settings, existing] = await Promise.all([
    t.qualification.list(ctx, eq(qualificationTable.instructorId, instructorId)),
    t.complianceItem.list(ctx, eq(complianceItemTable.instructorId, instructorId)),
    t.qualificationType.list(ctx),
    t.complianceType.list(ctx),
    t.orgSettings.list(ctx),
    t.notification.list(ctx, eq(notificationTable.instructorId, instructorId)),
  ]);
  const leadDays = settings[0]?.alertLeadDays ?? 30;
  const qualName = new Map(qualTypes.map((q) => [q.id, q.name]));
  const compName = new Map(compTypes.map((c) => [c.id, c.name]));

  const due: { key: string; name: string; expiry: string }[] = [];
  for (const q of quals) if (q.expiryDate) due.push({ key: `qualification:${q.id}`, name: qualName.get(q.qualificationTypeId) ?? "Cert", expiry: q.expiryDate });
  for (const c of items) if (c.expiryDate) due.push({ key: `compliance:${c.id}`, name: compName.get(c.complianceTypeId) ?? "Check", expiry: c.expiryDate });

  let raised = 0;
  for (const d of due) {
    const expiresAt = Date.parse(`${d.expiry}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt) || expiresAt > now + leadDays * DAY) continue;
    const expired = expiresAt < now;
    const marker = `[expiry:${d.key}]`;
    const recent = existing.find((n) => (n.body ?? "").includes(marker) && now - n.createdAt.getTime() < REPEAT_DAYS * DAY);
    if (recent) continue;
    const days = Math.ceil((expiresAt - now) / DAY);
    await notifyInstructor(repos, ctx, instructorId, {
      title: expired ? `${d.name} has expired` : `${d.name} expires in ${days} day${days === 1 ? "" : "s"}`,
      body: `${expired ? `It ran out on ${d.expiry}.` : `It runs out on ${d.expiry}.`} Renew it and upload the new copy under Docs so your centre can keep rostering you. ${marker}`,
      email: true,
    });
    raised++;
  }
  return { raised };
}
