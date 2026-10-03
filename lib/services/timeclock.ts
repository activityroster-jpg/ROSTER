import { and, eq, isNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { hoursRecord as hoursRecordTable, timeEntry as timeEntryTable, type TimeEntry } from "@/lib/db/schema";
import { durationMinutes, isoDateInTz } from "@/lib/domain";
import { writeAudit } from "./audit";
import { payRatesByInstructor, pickPayRate } from "./pay-rates";

/** Minutes elapsed on an entry — to its clock-out, or to `now` if still open. */
export function entryMinutes(entry: Pick<TimeEntry, "clockInAt" | "clockOutAt">, now: number): number {
  const end = entry.clockOutAt ? entry.clockOutAt.getTime() : now;
  return durationMinutes({ startAt: entry.clockInAt.getTime(), endAt: end });
}

/** The instructor's currently-open time entry (clocked in, not out), or null. */
export async function getOpenEntry(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<TimeEntry | null> {
  const rows = await repos.tenant.timeEntry.list(
    ctx,
    and(eq(timeEntryTable.instructorId, instructorId), isNull(timeEntryTable.clockOutAt))!,
  );
  return rows[0] ?? null;
}

/**
 * Clock an instructor in. No-op-safe: if they already have an open entry it is
 * returned rather than opening a second one. Tenant scoped, audited.
 */
export interface ClockFix { lat: number; lng: number; accuracyM: number | null }

export async function clockIn(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  courseSessionId: string | null = null,
  now: number = Date.now(),
  fix: ClockFix | null = null,
  note: string | null = null,
): Promise<TimeEntry> {
  const open = await getOpenEntry(repos, ctx, instructorId);
  if (open) return open;

  const entry = await repos.tenant.timeEntry.insert(ctx, {
    instructorId,
    courseSessionId,
    clockInAt: new Date(now),
    clockOutAt: null,
    source: "clock",
    note: note?.trim() || null,
    inLat: fix?.lat ?? null,
    inLng: fix?.lng ?? null,
    inAccuracyM: fix?.accuracyM ?? null,
  });
  await writeAudit(repos, ctx, {
    action: "clock_in",
    entity: "time_entry",
    entityId: entry.id,
    after: { instructorId, courseSessionId, clockInAt: now },
  });
  return entry;
}

/**
 * Clock an instructor out of their open entry. The elapsed minutes flow into the
 * matching hours_record (matched by instructor + session) as actual minutes, so
 * payroll runs on real time. Returns the closed entry, or null if none was open.
 */
export async function clockOut(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  now: number = Date.now(),
  fix: ClockFix | null = null,
): Promise<TimeEntry | null> {
  const open = await getOpenEntry(repos, ctx, instructorId);
  if (!open) return null;

  const closed = await repos.tenant.timeEntry.update(ctx, open.id, {
    clockOutAt: new Date(now),
    outLat: fix?.lat ?? null,
    outLng: fix?.lng ?? null,
    outAccuracyM: fix?.accuracyM ?? null,
  });
  if (!closed) return null;

  const minutes = entryMinutes(closed, now);
  await syncHoursRecord(repos, ctx, closed, minutes);

  await writeAudit(repos, ctx, {
    action: "clock_out",
    entity: "time_entry",
    entityId: closed.id,
    after: { instructorId, clockOutAt: now, actualMinutes: minutes },
  });
  return closed;
}

/** Write the entry's actual minutes onto the matching hours_record (or create one). */
async function syncHoursRecord(
  repos: Repositories,
  ctx: AnyTenantContext,
  entry: TimeEntry,
  minutes: number,
): Promise<void> {
  if (!entry.courseSessionId) return;

  const existing = (
    await repos.tenant.hoursRecord.list(
      ctx,
      and(
        eq(hoursRecordTable.instructorId, entry.instructorId),
        eq(hoursRecordTable.courseSessionId, entry.courseSessionId),
      )!,
    )
  )[0];

  if (existing) {
    await repos.tenant.hoursRecord.update(ctx, existing.id, { actualMinutes: minutes });
    return;
  }

  // No scheduled record yet (clocked in to a session they weren't rostered on)
  // — create one, taking scheduled minutes from the session and the rate from
  // their pay rate. It pays on the clock since that's all we know.
  const session = await repos.tenant.courseSession.findById(ctx, entry.courseSessionId);
  const scheduled = session ? durationMinutes({ startAt: session.startAt.getTime(), endAt: session.endAt.getTime() }) : minutes;
  const staff = session ? await repos.tenant.courseStaff.list(ctx) : [];
  const role = staff.find((a) => a.instructorId === entry.instructorId && a.courseId === session?.courseId)?.roleTypeId ?? null;
  const rate = pickPayRate((await payRatesByInstructor(repos, ctx)).get(entry.instructorId) ?? [], role);
  await repos.tenant.hoursRecord.insert(ctx, {
    instructorId: entry.instructorId,
    courseSessionId: entry.courseSessionId,
    scheduledMinutes: scheduled,
    actualMinutes: minutes,
    rate: rate?.rate ?? null,
    payUnit: rate?.unit ?? "hour",
    source: "clock",
    approved: false,
  });
}

export interface AttendanceRow {
  entryId: string;
  instructorId: string;
  instructorName: string;
  courseName: string | null;
  /** What they said they were doing when clocking in without a session. */
  note: string | null;
  clockInAt: number;
  clockOutAt: number | null;
  minutes: number;
  status: "on-water" | "done";
  /** Approximate positions recorded by the app (null when clocked from the web or permission refused). */
  inLocation: { lat: number; lng: number; accuracyM: number | null } | null;
  outLocation: { lat: number; lng: number; accuracyM: number | null } | null;
}

export interface AttendanceBoard {
  onWater: number;
  started: number;
  minutesToday: number;
  rows: AttendanceRow[];
}

/** Attendance for a given day (YYYY-MM-DD), with names and session labels. */
export async function getAttendanceBoard(
  repos: Repositories,
  ctx: AnyTenantContext,
  dayIso: string,
  now: number = Date.now(),
): Promise<AttendanceBoard> {
  const [entries, instructors, sessions, courses] = await Promise.all([
    repos.tenant.timeEntry.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.courseSession.list(ctx),
    repos.tenant.course.list(ctx),
  ]);

  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const courseNameById = new Map(courses.map((c) => [c.id, c.name ?? "Session"]));
  const sessionCourse = new Map(sessions.map((s) => [s.id, courseNameById.get(s.courseId) ?? null]));

  const rows: AttendanceRow[] = entries
    .filter((e) => isoDateInTz(e.clockInAt) === dayIso)
    .sort((a, b) => a.clockInAt.getTime() - b.clockInAt.getTime())
    .map((e) => ({
      entryId: e.id,
      instructorId: e.instructorId,
      instructorName: nameById.get(e.instructorId) ?? "Unknown",
      courseName: e.courseSessionId ? sessionCourse.get(e.courseSessionId) ?? null : null,
      note: e.note ?? null,
      clockInAt: e.clockInAt.getTime(),
      clockOutAt: e.clockOutAt ? e.clockOutAt.getTime() : null,
      minutes: entryMinutes(e, now),
      status: e.clockOutAt ? "done" : "on-water",
      inLocation: e.inLat != null && e.inLng != null ? { lat: e.inLat, lng: e.inLng, accuracyM: e.inAccuracyM ?? null } : null,
      outLocation: e.outLat != null && e.outLng != null ? { lat: e.outLat, lng: e.outLng, accuracyM: e.outAccuracyM ?? null } : null,
    }));

  return {
    onWater: rows.filter((r) => r.status === "on-water").length,
    started: rows.length,
    minutesToday: rows.reduce((a, r) => a + r.minutes, 0),
    rows,
  };
}
