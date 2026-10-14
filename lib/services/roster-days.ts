import { and, gte, lt } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, type AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseSession as courseSessionTable, courseStaff as courseStaffTable, instructor as instructorTable, rosterDay as rosterDayTable, sessionStaffOverride as overrideTable } from "@/lib/db/schema";
import { inList } from "@/lib/db/params";
import { managedByOffice } from "@/lib/domain/availability";
import { liveSessions } from "@/lib/domain/sessions";
import { effectiveStaffBySession } from "@/lib/domain/session-staff";
import { fmtWallTime } from "@/lib/domain/time";
import { diffDayShifts, type DayShifts } from "@/lib/domain/roster-day";
import { notifyInstructors } from "./notifications";
import { writeAudit } from "./audit";
import { addDays, weekStart } from "./schedule";

const weekOf = (dateIso: string) => weekStart(new Date(`${dateIso}T00:00:00Z`));
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The days the office has confirmed (YYYY-MM-DD). A day confirmed through
 * Confirm rota, or in a week published before days could be confirmed one by
 * one, unless that day has since been put back to pending.
 */
export async function confirmedDays(repos: Repositories, ctx: AnyTenantContext): Promise<Set<string>> {
  const [days, weeks] = await Promise.all([repos.tenant.rosterDay.list(ctx), repos.tenant.rosterWeek.list(ctx)]);
  const out = new Set<string>();
  for (const w of weeks) if (w.publishedAt) for (let i = 0; i < 7; i++) out.add(addDays(w.weekStart, i));
  for (const d of days) { if (d.confirmedAt) out.add(d.date); else out.delete(d.date); }
  return out;
}

export async function isDayConfirmed(repos: Repositories, ctx: AnyTenantContext, dateIso: string): Promise<boolean> {
  return (await confirmedDays(repos, ctx)).has(dateIso);
}

/** Who is on a set of days and in which shifts: date → instructor → shift lines. */
async function shiftsOn(repos: Repositories, ctx: AnyTenantContext, dates: readonly string[]) {
  const t = repos.tenant;
  if (!dates.length) return { byDay: new Map<string, DayShifts>(), labels: new Map<string, string>(), people: [] as string[] };
  const sorted = [...dates].sort();
  const sessions = liveSessions(await t.courseSession.list(ctx, and(gte(courseSessionTable.date, sorted[0]!), lt(courseSessionTable.date, addDays(sorted[sorted.length - 1]!, 1))))).filter((s) => dates.includes(s.date));
  const courseIds = [...new Set(sessions.map((s) => s.courseId))];
  const [staff, overrides, courses] = await Promise.all([
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, courseIds),
    t.sessionStaffOverride.listIn(ctx, overrideTable.courseSessionId, sessions.map((s) => s.id)),
    t.course.listIn(ctx, courseTable.id, courseIds),
  ]);
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Course"]));
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const byDay = new Map<string, DayShifts>(dates.map((d) => [d, {}]));
  const labels = new Map<string, string>();
  const people = new Set<string>();
  for (const [sessionId, members] of effectiveStaffBySession(sessions, staff, overrides)) {
    const s = byId.get(sessionId)!;
    // A shift is the session at its times: a move changes the key, so it reads as changed.
    const key = `${s.id}@${Number(s.startAt)}-${Number(s.endAt)}`;
    labels.set(key, `${fmtWallTime(s.startAt)}–${fmtWallTime(s.endAt)} · ${courseName.get(s.courseId) ?? "Course"}`);
    for (const m of members) {
      if (m.status === "declined") continue;
      const day = byDay.get(s.date)!;
      (day[m.instructorId] ??= []).push(key);
      people.add(m.instructorId);
    }
  }
  return { byDay, labels, people: [...people] };
}

export interface ConfirmDaysResult { days: number; notified: number; unreachable: string[] }

/**
 * Confirm roster days. The first time a day is confirmed everyone on it is
 * told; confirming a day again after it was put back to pending tells only
 * the people whose shifts changed meanwhile (added, moved or taken off).
 * Messages go out in the background (the in-app notice at once, email and
 * phone within a couple of minutes). When the centre asks staff to accept
 * shifts, office-managed people are accepted for them. Audited.
 */
export async function confirmDays(repos: Repositories, ctx: AnyTenantContext, dates: readonly string[]): Promise<ConfirmDaysResult> {
  const t = repos.tenant;
  const wanted = [...new Set(dates)].sort();
  if (!wanted.length) return { days: 0, notified: 0, unreachable: [] };
  const [rows, already, settingsRows] = await Promise.all([
    t.rosterDay.list(ctx, inList(rosterDayTable.date, wanted)),
    confirmedDays(repos, ctx),
    t.orgSettings.list(ctx),
  ]);
  const todo = wanted.filter((d) => !already.has(d));
  if (!todo.length) return { days: 0, notified: 0, unreachable: [] };
  const settings = settingsRows[0];
  const askToAccept = Boolean(settings?.staffAcceptShifts);
  const now = new Date();
  const by = actorUserId(ctx);
  const { byDay, labels, people: onDays } = await shiftsOn(repos, ctx, todo);

  // Per person: the shifts to tell them about, and the days they've come off.
  const tell = new Map<string, { on: { date: string; key: string }[]; off: string[] }>();
  for (const date of todo) {
    const row = rows.find((r) => r.date === date);
    const before: DayShifts | null = row?.snapshot ? (JSON.parse(row.snapshot) as DayShifts) : null;
    const current = byDay.get(date) ?? {};
    for (const [instructorId, change] of Object.entries(diffDayShifts(before, current))) {
      const entry = tell.get(instructorId) ?? { on: [], off: [] };
      if (change.shifts.length) entry.on.push(...change.shifts.map((key) => ({ date, key })));
      else if (change.removed) entry.off.push(date);
      tell.set(instructorId, entry);
    }
  }

  // Write the days first: a failed message never leaves a day unconfirmed.
  for (const date of todo) {
    const row = rows.find((r) => r.date === date);
    if (row) await t.rosterDay.update(ctx, row.id, { confirmedAt: now, confirmedByUserId: by, snapshot: null });
    else await t.rosterDay.insert(ctx, { date, confirmedAt: now, confirmedByUserId: by, snapshot: null });
  }

  const peopleRows = await t.instructor.listIn(ctx, instructorTable.id, [...new Set([...onDays, ...tell.keys()])]);
  const person = new Map(peopleRows.map((p) => [p.id, p]));
  const officeManaged = (id: string) => { const p = person.get(id); return p ? managedByOffice(p, settings) : false; };
  if (askToAccept) {
    const sessionIds = [...new Set([...byDay.values()].flatMap((d) => Object.values(d).flat()).map((k) => k.split("@")[0]!))];
    const sessions = sessionIds.length ? await t.courseSession.listIn(ctx, courseSessionTable.id, sessionIds) : [];
    const staff = sessions.length ? await t.courseStaff.listIn(ctx, courseStaffTable.courseId, [...new Set(sessions.map((s) => s.courseId))]) : [];
    const toAccept = staff.filter((a) => a.status === "assigned" && officeManaged(a.instructorId)).map((a) => a.id);
    if (toAccept.length) await t.courseStaff.updateWhere(ctx, inList(courseStaffTable.id, toAccept), { status: "confirmed", confirmedAt: now });
  }

  const unreachable: string[] = [];
  const items = [...tell].flatMap(([instructorId, change]) => {
    const p = person.get(instructorId);
    if (!p) return [];
    if (officeManaged(instructorId) && !p.userId && (!p.email || p.notifyEmail === false)) unreachable.push(p.name);
    const days = [...new Set(change.on.map((c) => c.date))];
    if (!days.length) {
      const offDays = change.off.map(fmtDay).join(", ");
      return [{ instructorId, input: { title: `Roster change: you're off ${offDays}`, body: `You're no longer rostered on ${offDays}.`, email: true } }];
    }
    const lines = change.on.map((c) => `${fmtDay(c.date)} · ${labels.get(c.key) ?? "Session"}`);
    const which = days.length === 1 ? fmtDay(days[0]!) : `${days.length} days from ${fmtDay(days[0]!)}`;
    const accept = askToAccept && !officeManaged(instructorId);
    return [{ instructorId, input: {
      title: `Roster confirmed: ${which}`,
      body: `${change.off.length ? `You're no longer on ${change.off.map(fmtDay).join(", ")}. ` : ""}Your shift${lines.length === 1 ? " is" : "s are"} confirmed.${accept ? " Open the app to accept or decline." : ""}`,
      email: true,
      detailLines: lines,
    } }];
  });
  const notified = await notifyInstructors(repos, ctx, items);
  await writeAudit(repos, ctx, { action: "confirm_roster_days", entity: "roster_day", entityId: todo[0]!, after: { days: todo, notified } });
  return { days: todo.length, notified, unreachable: unreachable.sort() };
}

/**
 * Put a confirmed day back to pending. The people on it get an in-app notice
 * (no email or phone message) that it may still change. Who is on it now is
 * kept, so confirming it again tells only the people whose shifts change in
 * the meantime. Audited.
 */
export async function undoDayConfirmation(repos: Repositories, ctx: AnyTenantContext, date: string): Promise<{ ok: boolean }> {
  const t = repos.tenant;
  if (!(await isDayConfirmed(repos, ctx, date))) return { ok: false };
  const { byDay } = await shiftsOn(repos, ctx, [date]);
  const snapshot = JSON.stringify(byDay.get(date) ?? {});
  const row = (await t.rosterDay.list(ctx, inList(rosterDayTable.date, [date])))[0];
  if (row) await t.rosterDay.update(ctx, row.id, { confirmedAt: null, snapshot });
  else await t.rosterDay.insert(ctx, { date, confirmedAt: null, confirmedByUserId: null, snapshot });
  await writeAudit(repos, ctx, { action: "undo_roster_day", entity: "roster_day", entityId: date, after: { date } });
  // Staff saw this day as confirmed: tell them, quietly, that it's back to pending.
  const day = fmtDay(date);
  await notifyInstructors(repos, ctx, Object.keys(byDay.get(date) ?? {}).map((instructorId) => ({ instructorId, input: {
    title: `Roster: ${day} is back to pending`,
    body: `Your centre has put ${day} back to pending while it makes changes. Your shift may still change; you'll get a message when the day is confirmed again.`,
    email: false,
    push: false,
  } })));
  return { ok: true };
}

/** The week's days (Monday on) with whether each is confirmed, for the board. */
export async function weekDayStates(repos: Repositories, ctx: AnyTenantContext, monday: string): Promise<{ date: string; confirmed: boolean }[]> {
  const confirmed = await confirmedDays(repos, ctx);
  const start = weekOf(monday);
  return Array.from({ length: 7 }, (_, i) => { const date = addDays(start, i); return { date, confirmed: confirmed.has(date) }; });
}
