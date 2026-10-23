import { eq, inArray } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  course as courseTable,
  courseSession as courseSessionTable,
  courseStaff as courseStaffTable,
  hoursRecord as hoursRecordTable,
  instructor as instructorTable,
  rosterDay as rosterDayTable,
  sessionStaffOverride as overrideTable,
  timeEntry as timeEntryTable,
  type SlotCode,
} from "@/lib/db/schema";
import { defaultPlaceType } from "@/lib/domain/teaching";
import { todayIso } from "@/lib/domain/time";
import { fillOpenRoles } from "./auto-roster";
import { writeAudit } from "./audit";
import { createCourseWithSessions } from "./courses";
import { addDays, weekStart } from "./schedule";
import { getTeachingContext } from "./teaching";

/**
 * The example week: six made-up instructors and a week of sessions, put on the
 * roster so a new centre sees a working roster before it has added anything of
 * its own. Everything it creates is marked `source = "example"` (people and
 * courses; their sessions, shifts and hours hang off those), so "Clear the
 * example" removes exactly that and nothing the centre added itself.
 */
export const EXAMPLE_SOURCE = "example";

/** Made-up people; the suffix keeps them obviously fictional on every screen and PDF. */
const PEOPLE: { name: string; employmentType: "employed" | "freelance" | "volunteer" }[] = [
  { name: "Alex Rivers (example)", employmentType: "employed" },
  { name: "Sam Harbour (example)", employmentType: "employed" },
  { name: "Priya Shore (example)", employmentType: "employed" },
  { name: "Jamie Tide (example)", employmentType: "freelance" },
  { name: "Morgan Reef (example)", employmentType: "employed" },
  { name: "Casey Bay (example)", employmentType: "freelance" },
];

export interface ExampleWeekState {
  loaded: boolean;
  instructors: number;
  courses: number;
  sessions: number;
  /** First and last date of the example's sessions (YYYY-MM-DD), when loaded. */
  from: string | null;
  to: string | null;
}

export async function exampleWeekState(repos: Repositories, ctx: AnyTenantContext): Promise<ExampleWeekState> {
  const t = repos.tenant;
  const [people, courses] = await Promise.all([
    t.instructor.list(ctx, eq(instructorTable.source, EXAMPLE_SOURCE)),
    t.course.list(ctx, eq(courseTable.source, EXAMPLE_SOURCE)),
  ]);
  const sessions = courses.length ? await t.courseSession.listIn(ctx, courseSessionTable.courseId, courses.map((c) => c.id)) : [];
  const dates = sessions.map((s) => s.date).sort();
  return {
    loaded: people.length > 0 || courses.length > 0,
    instructors: people.length,
    courses: courses.length,
    sessions: sessions.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

export type LoadExampleResult =
  | { ok: true; instructors: number; courses: number; sessions: number; filled: number; open: number; from: string; to: string }
  | { ok: false; error: string };

/**
 * Put the example on the roster: the next seven days, starting today. Two-day
 * courses on days 1–2, 4–5 and 6–7, an evening session on day 3, from the
 * courses the centre has ticked (the common ones first, when the pack names
 * them), with six people who hold the instructor type each course needs. The
 * week is then filled by Auto-roster, through the normal checks, using only
 * the example people, so nobody real is put on a made-up course.
 */
export async function loadExampleWeek(
  repos: Repositories,
  ctx: AnyTenantContext,
  opts: { preferredCourseNames?: readonly string[]; today?: string } = {},
): Promise<LoadExampleResult> {
  const t = repos.tenant;
  const state = await exampleWeekState(repos, ctx);
  if (state.loaded) return { ok: false, error: "The example week is already on the roster. Clear it first if you want it again." };

  const [courseTypes, roles, slotRows, tc] = await Promise.all([
    t.courseType.list(ctx),
    t.roleType.list(ctx),
    t.sessionSlot.list(ctx),
    getTeachingContext(repos, ctx),
  ]);
  const active = courseTypes.filter((c) => c.active);
  if (active.length === 0) return { ok: false, error: "Tick at least one course you run first (Course setup), so the example has something to roster." };

  // Courses: the pack's common ones first, in its order, then the rest by name;
  // prefer types the course map knows who can teach, so the week can be filled.
  const preferred = opts.preferredCourseNames ?? [];
  const rank = (name: string) => { const i = preferred.indexOf(name); return i === -1 ? preferred.length : i; };
  const ordered = [...active].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  const mapped = ordered.filter((c) => (tc.rulesByCourse.get(c.id) ?? []).length > 0);
  const picked = [...mapped, ...ordered.filter((c) => !mapped.includes(c))].slice(0, 4);

  // The instructor type each course needs (its lead place), and safety cover if the centre has it.
  const leadType = new Map(picked.map((c) => [c.id, defaultPlaceType(tc.rulesByCourse.get(c.id), tc.types, tc.courseDiscipline.get(c.id) ?? null)]));
  const safetyType = roles.find((r) => r.active && r.isSafetyCover && r.qualificationTypeId)?.qualificationTypeId ?? null;
  const today = opts.today ?? todayIso();
  const expiry = addDays(today, 400);

  // People: each holds the type for two of the courses, so every course has at least two or three who can teach it.
  const instructorIds: string[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i]!;
    const row = await t.instructor.insert(ctx, { name: p.name, email: null, phone: null, employmentType: p.employmentType, status: "active", managedBy: "office", source: EXAMPLE_SOURCE });
    instructorIds.push(row.id);
    const mine = picked.length ? [picked[i % picked.length]!, picked[(i + 1) % picked.length]!] : [];
    const held = new Set<string>();
    for (const c of mine) {
      const typeId = leadType.get(c.id);
      if (typeId && !held.has(typeId)) {
        held.add(typeId);
        await t.qualification.insert(ctx, { instructorId: row.id, qualificationTypeId: typeId, certNo: null, issueDate: null, expiryDate: expiry, verified: true });
      }
      await t.instructorCourseType.insert(ctx, { instructorId: row.id, courseTypeId: c.id });
    }
    if (safetyType && (i === 1 || i === 4) && !held.has(safetyType)) {
      await t.qualification.insert(ctx, { instructorId: row.id, qualificationTypeId: safetyType, certNo: null, issueDate: null, expiryDate: expiry, verified: true });
    }
  }

  // Sessions in the centre's own slots: mornings and afternoons for day courses, the evening for the club night.
  const codes = new Set(slotRows.filter((s) => s.active !== false).map((s) => s.code));
  const dayParts = (["AM", "PM"] as const).filter((c) => codes.has(c));
  const daySlots: SlotCode[] = dayParts.length ? [...dayParts] : [slotRows[0]?.code ?? "AM"];
  const evening: SlotCode = codes.has("EV") ? "EV" : daySlots[daySlots.length - 1]!;
  const d = (n: number) => addDays(today, n);
  const plan: { type: (typeof picked)[number]; sessions: { date: string; slot: SlotCode }[] }[] = [
    { type: picked[0]!, sessions: [d(0), d(1)].flatMap((date) => daySlots.map((slot) => ({ date, slot }))) },
    { type: picked[1 % picked.length]!, sessions: [{ date: d(2), slot: evening }] },
    { type: picked[2 % picked.length]!, sessions: [d(3), d(4)].flatMap((date) => daySlots.map((slot) => ({ date, slot }))) },
    { type: picked[3 % picked.length]!, sessions: [d(5), d(6)].flatMap((date) => daySlots.map((slot) => ({ date, slot }))) },
  ];
  const courseIds: string[] = [];
  let sessions = 0;
  for (const p of plan) {
    const { courseId } = await createCourseWithSessions(repos, ctx, { courseTypeId: p.type.id, sessions: p.sessions, source: EXAMPLE_SOURCE });
    courseIds.push(courseId);
    sessions += p.sessions.length;
  }

  // Fill the week with the example people only.
  const only = { onlyInstructorIds: new Set(instructorIds), onlyCourseIds: new Set(courseIds) };
  let filled = 0;
  let open = 0;
  for (const monday of new Set([weekStart(new Date(`${d(0)}T00:00:00Z`)), weekStart(new Date(`${d(6)}T00:00:00Z`))])) {
    const r = await fillOpenRoles(repos, ctx, monday, only);
    filled += r.filled;
    open += r.stillOpen;
  }

  await writeAudit(repos, ctx, { action: "load_example_week", entity: "roster", entityId: d(0), after: { from: d(0), to: d(6), instructors: instructorIds.length, courses: courseIds.length, sessions, filled, open } });
  return { ok: true, instructors: instructorIds.length, courses: courseIds.length, sessions, filled, open, from: d(0), to: d(6) };
}

/**
 * Take the example off again: its shifts (on any course, in case someone was
 * dragged onto a real one), its courses with their sessions, hours and clock
 * entries, then the people with everything that hangs off them. A day confirmed
 * while only the example was on it goes back to unconfirmed. Nothing the centre
 * added itself is touched.
 */
export async function clearExampleWeek(repos: Repositories, ctx: AnyTenantContext): Promise<{ ok: true; instructors: number; courses: number } | { ok: false; error: string }> {
  const t = repos.tenant;
  const [people, courses] = await Promise.all([
    t.instructor.list(ctx, eq(instructorTable.source, EXAMPLE_SOURCE)),
    t.course.list(ctx, eq(courseTable.source, EXAMPLE_SOURCE)),
  ]);
  if (people.length === 0 && courses.length === 0) return { ok: false, error: "There is no example week to clear." };
  const peopleIds = people.map((p) => p.id);
  const courseIds = courses.map((c) => c.id);
  const sessions = courseIds.length ? await t.courseSession.listIn(ctx, courseSessionTable.courseId, courseIds) : [];
  const sessionIds = sessions.map((s) => s.id);
  const dates = [...new Set(sessions.map((s) => s.date))];

  if (peopleIds.length) {
    await t.courseStaff.deleteWhere(ctx, inArray(courseStaffTable.instructorId, peopleIds));
    await t.sessionStaffOverride.deleteWhere(ctx, inArray(overrideTable.instructorId, peopleIds));
  }
  if (sessionIds.length) {
    await t.hoursRecord.deleteWhere(ctx, inArray(hoursRecordTable.courseSessionId, sessionIds));
    await t.timeEntry.deleteWhere(ctx, inArray(timeEntryTable.courseSessionId, sessionIds));
  }
  if (courseIds.length) await t.course.deleteWhere(ctx, eq(courseTable.source, EXAMPLE_SOURCE)); // cascades sessions, shifts, places, kit, role lines
  if (peopleIds.length) await t.instructor.deleteWhere(ctx, eq(instructorTable.source, EXAMPLE_SOURCE)); // cascades types, approvals, availability, hours, notes
  if (dates.length) {
    const left = new Set((await t.courseSession.listIn(ctx, courseSessionTable.date, dates)).map((s) => s.date));
    const empty = dates.filter((x) => !left.has(x));
    if (empty.length) await t.rosterDay.deleteWhere(ctx, inArray(rosterDayTable.date, empty));
  }

  await writeAudit(repos, ctx, { action: "clear_example_week", entity: "roster", entityId: dates[0] ?? null, before: { instructors: peopleIds.length, courses: courseIds.length, sessions: sessionIds.length } });
  return { ok: true, instructors: peopleIds.length, courses: courseIds.length };
}
