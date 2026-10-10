import { and, gte, like } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { availability as availabilityTable, notification as notificationTable } from "@/lib/db/schema";
import { managedByOffice } from "@/lib/domain/availability";
import { reminderMarker, type ReminderKind } from "@/lib/notify/markers";
import { listStaffWithFit } from "./staff";
import { notifyInstructors } from "./notifications";
import { writeAudit } from "./audit";

/** One reminder of each kind per person per day, however many times the button is pressed. */
export const REMINDER_GAP_HOURS = 24;

export interface ReminderOutcome { sent: number; recent: number; notNeeded: number; unreachable: number }

/**
 * The office reminds people to set their availability, or to update licences
 * and checks that are missing, expired or running out. Sent in the app (with a
 * phone push) and by email, like the centre's other notices; re-checked here so
 * only people who still need it are reminded. Restricted or anonymised people,
 * and anyone the office keeps availability for, are never sent one.
 */
export async function remindStaff(repos: Repositories, ctx: AnyTenantContext, kind: ReminderKind, instructorIds: string[], centreName: string): Promise<ReminderOutcome> {
  const wanted = new Set(instructorIds);
  const staff = (await listStaffWithFit(repos, ctx)).filter(({ instructor: i }) => wanted.has(i.id) && i.status === "active" && !i.restrictedAt && !i.anonymisedAt);

  let needs = staff;
  if (kind === "availability") {
    const settingsRow = (await repos.tenant.orgSettings.list(ctx))[0];
    const withAvailability = new Set((await repos.tenant.availability.distinct(ctx, availabilityTable.instructorId)) as string[]);
    // Setting availability needs the app, so only people who have signed up.
    needs = staff.filter(({ instructor: i }) => !managedByOffice(i, settingsRow) && !withAvailability.has(i.id));
  } else {
    needs = staff.filter(({ fit }) => !fit.fit || fit.warnings.length > 0);
  }
  const reachable = needs.filter(({ instructor: i }) => (kind === "availability" ? Boolean(i.userId) : Boolean(i.userId || i.email)));

  const since = new Date(Date.now() - REMINDER_GAP_HOURS * 60 * 60 * 1000);
  const recentRows = reachable.length
    ? await repos.tenant.notification.listIn(ctx, notificationTable.instructorId, reachable.map((s) => s.instructor.id), and(gte(notificationTable.createdAt, since), like(notificationTable.body, `%${reminderMarker(kind)}%`)))
    : [];
  const recentlyReminded = new Set(recentRows.map((n) => n.instructorId));
  const toSend = reachable.filter((s) => !recentlyReminded.has(s.instructor.id));

  const sent = await notifyInstructors(repos, ctx, toSend.map(({ instructor: i, fit }) => {
    if (kind === "availability") {
      return { instructorId: i.id, input: {
        title: `${centreName}: please mark when you're free`,
        body: `Your centre needs your availability to plan the roster. Open the ActivityRoster app and mark the days you can work under Availability. ${reminderMarker(kind)}`,
        email: true,
      } };
    }
    const gaps = [
      ...fit.blocks.map((b) => `${b.name} ${b.kind === "missing" ? "is missing" : "has expired"}`),
      ...fit.warnings.map((w) => `${w.name} runs out soon`),
    ];
    return { instructorId: i.id, input: {
      title: `${centreName}: please update your licences`,
      body: `${gaps.join("; ")}. Upload the new copy under Docs in the ActivityRoster app so your centre can keep rostering you. ${reminderMarker(kind)}`,
      email: true,
    } };
  }));

  if (sent > 0) {
    await writeAudit(repos, ctx, { action: "notify", entity: "instructor", entityId: toSend.length === 1 ? toSend[0]!.instructor.id : null, after: { reminder: kind, sent, instructorIds: toSend.map((s) => s.instructor.id) } });
  }
  return { sent, recent: recentlyReminded.size, notNeeded: staff.length - needs.length, unreachable: needs.length - reachable.length };
}
