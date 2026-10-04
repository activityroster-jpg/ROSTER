import { and, eq, isNotNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  availability as availabilityTable,
  availabilityNote as availabilityNoteTable,
  SLOT_CODES,
  type AvailabilitySetBy,
  type OrgSettings,
  type SlotCode,
} from "@/lib/db/schema";
import { addDays } from "./schedule";
import { writeAudit } from "./audit";
import { liveSessions } from "@/lib/domain/sessions";
import { todayIso } from "@/lib/domain/time";
import {
  addDaysIso,
  courseAvailState,
  effectiveAvailability,
  horizonFor,
  indexAvailability,
  keyOf,
  patternKeyOf,
  type AvailabilityAnswer,
  type AvailabilityHorizon,
  type AvailabilityIndex,
  type AvailabilitySource,
  type CourseAvailState,
  type EffectiveStatus,
} from "@/lib/domain/availability";

export type AvailabilityStatus = AvailabilityAnswer;
export type { AvailabilityHorizon, AvailabilityIndex, CourseAvailState, EffectiveStatus, AvailabilitySource };

/** The window the centre is asking about right now, from its settings. */
export function availabilityHorizon(settings: Pick<OrgSettings, "availabilityWeeksAhead" | "timezone"> | null | undefined, now: number = Date.now()): AvailabilityHorizon {
  return horizonFor(todayIso(settings?.timezone ?? undefined, now), settings?.availabilityWeeksAhead ?? 4);
}

async function horizonOf(repos: Repositories, ctx: AnyTenantContext): Promise<AvailabilityHorizon> {
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  return availabilityHorizon(settings);
}

/** Everything one instructor has said: dated answers, their usual week, and day notes. */
export async function loadInstructorAvailability(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<{ index: AvailabilityIndex; notes: Record<string, string>; setBy: Record<string, AvailabilitySetBy> }> {
  const [rows, noteRows] = await Promise.all([
    repos.tenant.availability.list(ctx, eq(availabilityTable.instructorId, instructorId)),
    repos.tenant.availabilityNote.list(ctx, eq(availabilityNoteTable.instructorId, instructorId)),
  ]);
  const setBy: Record<string, AvailabilitySetBy> = {};
  for (const r of rows) if (r.date) setBy[keyOf(r.date, r.slot)] = r.setBy;
  return { index: indexAvailability(rows), notes: Object.fromEntries(noteRows.map((n) => [n.date, n.note])), setBy };
}

/** Map of "date|slot" → dated answer for a week, for one instructor (answers only, no defaults). */
export async function getWeekAvailability(repos: Repositories, ctx: AnyTenantContext, instructorId: string, mondayIso: string): Promise<Record<string, AvailabilityStatus>> {
  return getAvailabilityRange(repos, ctx, instructorId, mondayIso, addDays(mondayIso, 7));
}

/** Map of "date|slot" → dated answer across [fromIso, toIso), one instructor (answers only, no defaults). */
export async function getAvailabilityRange(repos: Repositories, ctx: AnyTenantContext, instructorId: string, fromIso: string, toIso: string): Promise<Record<string, AvailabilityStatus>> {
  const rows = await repos.tenant.availability.list(ctx, eq(availabilityTable.instructorId, instructorId));
  const out: Record<string, AvailabilityStatus> = {};
  for (const r of rows) {
    if (!r.date || r.date < fromIso || r.date >= toIso) continue;
    out[keyOf(r.date, r.slot)] = r.status;
  }
  return out;
}

const DATED_KEY = { target: [availabilityTable.instructorId, availabilityTable.date, availabilityTable.slot], targetWhere: isNotNull(availabilityTable.date) };
const WEEKDAY_KEY = { target: [availabilityTable.instructorId, availabilityTable.weekday, availabilityTable.slot], targetWhere: isNotNull(availabilityTable.weekday) };

export interface SetAvailabilityOptions {
  /** Who is writing: the instructor (default), the office on their behalf, or approved leave. */
  setBy?: AvailabilitySetBy;
  /** Skip the audit row (the caller writes one for the whole batch). */
  silent?: boolean;
}

/**
 * Set (or clear) an instructor's answer for a specific date + slot. One row per
 * key, enforced by the database, so two quick taps cannot leave two rows. `null`
 * clears the dated answer, so the usual week or the Busy default applies again.
 */
export async function setAvailability(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  date: string,
  slot: SlotCode,
  status: AvailabilityStatus | null,
  opts: SetAvailabilityOptions = {},
): Promise<void> {
  const setBy = opts.setBy ?? "self";
  let entityId: string | null = null;
  if (status === null) {
    const existing = await repos.tenant.availability.list(ctx, and(eq(availabilityTable.instructorId, instructorId), eq(availabilityTable.date, date), eq(availabilityTable.slot, slot)));
    for (const row of existing) await repos.tenant.availability.delete(ctx, row.id);
    entityId = existing[0]?.id ?? null;
  } else {
    const row = await repos.tenant.availability.upsert(ctx, { instructorId, date, weekday: null, slot, status, setBy }, DATED_KEY, { status, setBy, updatedAt: new Date() });
    entityId = row.id;
  }
  if (!opts.silent) {
    await writeAudit(repos, ctx, {
      action: setBy === "office" ? "set_availability_office" : setBy === "leave" ? "set_availability_leave" : "set_availability",
      entity: "availability",
      entityId,
      after: { instructorId, date, slot, status, setBy },
    });
  }
}

/** Set many dated answers in one go (copy last week, mark the week free). Each write is an idempotent upsert; one audit row covers the batch. */
export async function setAvailabilityMany(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  entries: readonly { date: string; slot: SlotCode; status: AvailabilityStatus | null }[],
  opts: SetAvailabilityOptions = {},
): Promise<void> {
  for (const e of entries) await setAvailability(repos, ctx, instructorId, e.date, e.slot, e.status, { ...opts, silent: true });
  if (!opts.silent) {
    const dates = entries.map((e) => e.date).sort();
    await writeAudit(repos, ctx, {
      action: opts.setBy === "office" ? "set_availability_office" : opts.setBy === "leave" ? "set_availability_leave" : "set_availability",
      entity: "availability",
      entityId: null,
      after: { instructorId, count: entries.length, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null, setBy: opts.setBy ?? "self" },
    });
  }
}

/** Set (or clear) one slot of the instructor's usual week. `weekday` is 0 = Sunday … 6 = Saturday. */
export async function setAvailabilityPattern(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  weekday: number,
  slot: SlotCode,
  status: AvailabilityStatus | null,
  opts: SetAvailabilityOptions = {},
): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("weekday must be 0–6");
  const setBy = opts.setBy ?? "self";
  if (status === null) {
    const existing = await repos.tenant.availability.list(ctx, and(eq(availabilityTable.instructorId, instructorId), eq(availabilityTable.weekday, weekday), eq(availabilityTable.slot, slot)));
    for (const row of existing) await repos.tenant.availability.delete(ctx, row.id);
  } else {
    await repos.tenant.availability.upsert(ctx, { instructorId, date: null, weekday, slot, status, setBy }, WEEKDAY_KEY, { status, setBy, updatedAt: new Date() });
  }
  if (!opts.silent) await writeAudit(repos, ctx, { action: "set_availability_pattern", entity: "availability", entityId: null, after: { instructorId, weekday, slot, status, setBy } });
}

/** Leave or replace the instructor's note for one day; empty clears it. */
export async function setAvailabilityNote(repos: Repositories, ctx: AnyTenantContext, instructorId: string, date: string, note: string | null, opts: SetAvailabilityOptions = {}): Promise<void> {
  const text = (note ?? "").trim().slice(0, 140);
  if (!text) {
    const existing = await repos.tenant.availabilityNote.list(ctx, and(eq(availabilityNoteTable.instructorId, instructorId), eq(availabilityNoteTable.date, date)));
    for (const row of existing) await repos.tenant.availabilityNote.delete(ctx, row.id);
  } else {
    await repos.tenant.availabilityNote.upsert(ctx, { instructorId, date, note: text }, { target: [availabilityNoteTable.instructorId, availabilityNoteTable.date] }, { note: text, updatedAt: new Date() });
  }
  if (!opts.silent) await writeAudit(repos, ctx, { action: "set_availability_note", entity: "availability_note", entityId: null, after: { instructorId, date, note: text || null, setBy: opts.setBy ?? "self" } });
}

/** Approved leave writes Busy into every slot of every day it covers, so the roster and the picker see it. */
export async function markLeaveBusy(repos: Repositories, ctx: AnyTenantContext, instructorId: string, startDate: string, endDate: string): Promise<number> {
  const entries: { date: string; slot: SlotCode; status: AvailabilityStatus }[] = [];
  for (let d = startDate; d <= endDate && entries.length < 3 * 366; d = addDaysIso(d, 1)) {
    for (const slot of SLOT_CODES) entries.push({ date: d, slot, status: "unavailable" });
  }
  await setAvailabilityMany(repos, ctx, instructorId, entries, { setBy: "leave" });
  return entries.length;
}

/** The effective answer for one instructor on one date and slot, with the window applied. */
export async function effectiveFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string, date: string, slot: SlotCode, horizon?: AvailabilityHorizon) {
  const [{ index }, h] = await Promise.all([loadInstructorAvailability(repos, ctx, instructorId), horizon ? Promise.resolve(horizon) : horizonOf(repos, ctx)]);
  return effectiveAvailability(index, h, date, slot);
}

export interface AvailabilityMatrixRow {
  instructorId: string;
  name: string;
  /** Effective status for every `${dateIso}|${slot}` of the week. */
  cells: Record<string, EffectiveStatus>;
  /** Where each cell's status came from. */
  sources: Record<string, AvailabilitySource>;
  /** Who wrote each dated answer. */
  setBy: Record<string, AvailabilitySetBy>;
  /** The instructor's note per date. */
  notes: Record<string, string>;
  /** Courses this instructor is rostered on, keyed `${dateIso}|${slot}`. */
  assigned: Record<string, string[]>;
}
export interface AvailabilityMatrix {
  days: string[]; // 7 ISO dates, Mon→Sun
  rows: AvailabilityMatrixRow[];
  /** Count of instructors Free per `${dateIso}|${slot}` (dated or usual week). */
  availableCounts: Record<string, number>;
  horizon: AvailabilityHorizon;
}

/**
 * Org-wide availability for a week: every active instructor × day × slot with the
 * Busy default and usual weeks applied, plus a count of how many are free in each
 * slot and what each person is already rostered on. Tenant scoped.
 */
export async function getWeekAvailabilityMatrix(repos: Repositories, ctx: AnyTenantContext, mondayIso: string): Promise<AvailabilityMatrix> {
  const [instructors, rows, noteRows, sessions, staff, courses, courseTypes, horizon] = await Promise.all([
    repos.tenant.instructor.list(ctx),
    repos.tenant.availability.list(ctx),
    repos.tenant.availabilityNote.list(ctx),
    repos.tenant.courseSession.list(ctx).then(liveSessions),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.course.list(ctx),
    repos.tenant.courseType.list(ctx),
    horizonOf(repos, ctx),
  ]);
  const sunday = addDays(mondayIso, 7);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(mondayIso, i));

  const rowsByInstructor = new Map<string, typeof rows>();
  for (const r of rows) rowsByInstructor.set(r.instructorId, [...(rowsByInstructor.get(r.instructorId) ?? []), r]);
  const notesByInstructor = new Map<string, Record<string, string>>();
  for (const n of noteRows) {
    if (n.date < mondayIso || n.date >= sunday) continue;
    const m = notesByInstructor.get(n.instructorId) ?? {};
    m[n.date] = n.note;
    notesByInstructor.set(n.instructorId, m);
  }

  // Assignments in this week: instructor → "date|slot" → course names.
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? courseTypes.find((t) => t.id === c.courseTypeId)?.name ?? "Course"]));
  const instructorsByCourse = new Map<string, string[]>();
  for (const a of staff) instructorsByCourse.set(a.courseId, [...(instructorsByCourse.get(a.courseId) ?? []), a.instructorId]);
  const fmtT = (v: Date | number) => new Date(v instanceof Date ? v.getTime() : Number(v)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const assignedByInstructor = new Map<string, Record<string, string[]>>();
  for (const s of sessions) {
    if (s.date < mondayIso || s.date >= sunday) continue;
    const key = keyOf(s.date, s.slot);
    const label = `${courseName.get(s.courseId) ?? "Course"} (${fmtT(s.startAt)}–${fmtT(s.endAt)})`;
    for (const insId of instructorsByCourse.get(s.courseId) ?? []) {
      const map = assignedByInstructor.get(insId) ?? {};
      map[key] = [...(map[key] ?? []), label];
      assignedByInstructor.set(insId, map);
    }
  }

  const availableCounts: Record<string, number> = {};
  const active = instructors.filter((i) => i.status === "active").sort((a, b) => a.name.localeCompare(b.name));
  const out: AvailabilityMatrixRow[] = active.map((i) => {
    const mine = rowsByInstructor.get(i.id) ?? [];
    const index = indexAvailability(mine);
    const cells: Record<string, EffectiveStatus> = {};
    const sources: Record<string, AvailabilitySource> = {};
    const setBy: Record<string, AvailabilitySetBy> = {};
    for (const r of mine) if (r.date && r.date >= mondayIso && r.date < sunday) setBy[keyOf(r.date, r.slot)] = r.setBy;
    for (const d of days) for (const slot of SLOT_CODES) {
      const e = effectiveAvailability(index, horizon, d, slot);
      const k = keyOf(d, slot);
      cells[k] = e.status;
      sources[k] = e.source;
      if (e.status === "available") availableCounts[k] = (availableCounts[k] ?? 0) + 1;
    }
    return { instructorId: i.id, name: i.name, cells, sources, setBy, notes: notesByInstructor.get(i.id) ?? {}, assigned: assignedByInstructor.get(i.id) ?? {} };
  });
  return { days, rows: out, availableCounts, horizon };
}

/**
 * For each course, each instructor's standing against that course's session
 * dates/slots (see {@link CourseAvailState}). Rostering is never blocked by this
 * view — the assignment check does that — it just makes the picker honest.
 */
export async function getCourseAvailabilityStates(repos: Repositories, ctx: AnyTenantContext): Promise<Map<string, Map<string, CourseAvailState>>> {
  const [sessions, availRows, instructors, horizon] = await Promise.all([
    repos.tenant.courseSession.list(ctx).then(liveSessions),
    repos.tenant.availability.list(ctx),
    repos.tenant.instructor.list(ctx),
    horizonOf(repos, ctx),
  ]);
  const rowsByInstructor = new Map<string, typeof availRows>();
  for (const r of availRows) rowsByInstructor.set(r.instructorId, [...(rowsByInstructor.get(r.instructorId) ?? []), r]);
  const indexes = new Map(instructors.map((i) => [i.id, indexAvailability(rowsByInstructor.get(i.id) ?? [])]));

  const slotsByCourse = new Map<string, string[]>();
  for (const s of sessions) slotsByCourse.set(s.courseId, [...(slotsByCourse.get(s.courseId) ?? []), keyOf(s.date, s.slot)]);

  const out = new Map<string, Map<string, CourseAvailState>>();
  for (const [courseId, keys] of slotsByCourse) {
    const perInstructor = new Map<string, CourseAvailState>();
    for (const ins of instructors) perInstructor.set(ins.id, courseAvailState(indexes.get(ins.id)!, horizon, keys));
    out.set(courseId, perInstructor);
  }
  return out;
}

/** The usual-week pattern as `${weekday}|${slot}` → status, for one instructor. */
export function patternOf(index: AvailabilityIndex): Record<string, AvailabilityStatus> {
  const out: Record<string, AvailabilityStatus> = {};
  for (let wd = 0; wd < 7; wd++) for (const slot of SLOT_CODES) {
    const v = index.pattern[patternKeyOf(wd, slot)];
    if (v) out[patternKeyOf(wd, slot)] = v;
  }
  return out;
}

export const AVAILABILITY_SLOTS = SLOT_CODES;
