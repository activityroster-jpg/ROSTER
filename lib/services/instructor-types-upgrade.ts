import { gte } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  course as courseTable,
  courseRoleRequirement as courseRoleRequirementTable,
  courseSession as courseSessionTable,
  courseStaff as courseStaffTable,
  sessionStaffOverride as sessionStaffOverrideTable,
} from "@/lib/db/schema";
import { runAtomic } from "@/lib/db/batch";
import { DEFAULT_COURSE_TYPES, DEFAULT_GRADES, LEGACY_GENERIC_ROLE_CODES } from "@/lib/seed/catalogue";
import { RYA_TEACHING } from "@/lib/packs/rya-teaching";
import { TEACHING_MAP_VERSION } from "@/lib/seed/seed";
import { defaultPlaceType, rulesByCourse, schemeDiscipline, typesForCourse, type TeachRule, type TypeInfo } from "@/lib/domain/teaching";
import { auditStatement } from "./audit";

/**
 * Bring an existing RYA centre onto instructor types (13 Oct 2026): Conor's
 * instructor-type ladder and course list become the source of truth, places
 * on courses become instructor types, and there is no separate safety boat
 * driver. Safe to run more than once; a dry run reports what would change and
 * writes nothing.
 *
 *  1. Instructor types: added or brought up to date by code (an untouched old
 *     default name is renamed, e.g. "Dinghy Senior Instructor" → "Senior
 *     Instructor"); ladders, ranks and supervision set. What people hold
 *     follows automatically (it points at the type).
 *  2. One place on courses per instructor type with a ladder.
 *  3. Course types: the new ones added (switched on only where the centre runs
 *     that scheme), ratios still on the old default moved to the new one (and
 *     upcoming courses still on the old ratio with them), safety-boat cover off.
 *  4. Who can teach what: the course map, for each course nobody has set.
 *  5. Upcoming courses only: generic Instructor / Senior / Assistant places
 *     (role lines, people, one-day changes, open shifts) become the course's
 *     instructor-type places; Safety Boat Driver lines go and drivers become
 *     instructors. Past courses keep their old places (retired, still shown).
 *  6. Pay rates for the generic places are copied to the instructor-type
 *     places in use, so nobody's pay changes.
 *  7. The generic places are retired, and the centre is marked done. If
 *     something couldn't be converted (a course nobody has linked an
 *     instructor type to), the generic places stay and the centre stays on
 *     the list to run again once that's fixed.
 */

/** The old default codes and names (before 13 Oct 2026), to recognise an untouched type. Keyed by the new code. */
const LEGACY_GRADES: Record<string, { code: string; name: string }> = {
  AI: { code: "DAI", name: "Dinghy Assistant Instructor" },
  SI: { code: "DSI", name: "Dinghy Senior Instructor" },
  KBI: { code: "KBI", name: "Keelboat Instructor" },
  WI: { code: "WI", name: "Windsurfing Instructor" },
  CI: { code: "CI", name: "Cruising Instructor" },
  YMI: { code: "YMI", name: "Yachtmaster Instructor" },
  SBI: { code: "SBI", name: "Shorebased Instructor" },
};

/** The old default capacity and students-per-instructor of each RYA course type, to update only the untouched ones. */
const LEGACY_COURSE_DEFAULTS: Record<string, { capacity: number; ratio: number }> = {
  "Start Sailing (Level 1)": { capacity: 6, ratio: 3 },
  "Basic Skills (Level 2)": { capacity: 6, ratio: 3 },
  "Improving Skills": { capacity: 6, ratio: 3 },
  "Day Sailing": { capacity: 6, ratio: 3 },
  "Seamanship Skills": { capacity: 6, ratio: 3 },
  "Sailing with Spinnakers": { capacity: 6, ratio: 3 },
  "Performance Sailing": { capacity: 6, ratio: 3 },
  "Youth Stage 1": { capacity: 8, ratio: 4 },
  "Youth Stage 2": { capacity: 8, ratio: 4 },
  "Youth Stage 3": { capacity: 8, ratio: 4 },
  "Youth Stage 4": { capacity: 8, ratio: 4 },
  "Youth Advanced Boat Handling": { capacity: 8, ratio: 4 },
  "Summer Camp (5-day)": { capacity: 12, ratio: 4 },
  "Junior Club Session": { capacity: 16, ratio: 4 },
  "School Group Session": { capacity: 16, ratio: 4 },
  "Club Racing": { capacity: 8, ratio: 4 },
  "Race Coaching": { capacity: 8, ratio: 4 },
  "Sailability Session": { capacity: 8, ratio: 2 },
  "Start Windsurfing": { capacity: 6, ratio: 3 },
  "Intermediate Windsurfing": { capacity: 6, ratio: 3 },
  "Advanced Windsurfing": { capacity: 6, ratio: 3 },
  "Start Paddleboarding": { capacity: 8, ratio: 6 },
  "Progression Paddleboarding": { capacity: 8, ratio: 6 },
  "Powerboat Level 1": { capacity: 3, ratio: 3 },
  "Powerboat Level 2": { capacity: 3, ratio: 3 },
  "Intermediate Powerboat": { capacity: 3, ratio: 3 },
  "Advanced Powerboat": { capacity: 3, ratio: 3 },
  "Safety Boat Course": { capacity: 3, ratio: 3 },
  "Personal Watercraft (PWC / Jet Ski)": { capacity: 3, ratio: 3 },
  "Start Keelboating": { capacity: 4, ratio: 2 },
  "Start Yachting": { capacity: 4, ratio: 4 },
  "Competent Crew": { capacity: 5, ratio: 5 },
  "Day Skipper (Practical)": { capacity: 5, ratio: 5 },
  "Coastal Skipper (Practical)": { capacity: 5, ratio: 5 },
  "Yachtmaster Preparation": { capacity: 4, ratio: 4 },
};

/** The old generic places, by code (and by name, for a centre that changed the code). */
const GENERIC_NAMES: Record<string, string> = {
  [LEGACY_GENERIC_ROLE_CODES.instructor]: "instructor",
  [LEGACY_GENERIC_ROLE_CODES.senior]: "senior instructor",
  [LEGACY_GENERIC_ROLE_CODES.assistant]: "assistant instructor",
  [LEGACY_GENERIC_ROLE_CODES.safetyBoat]: "safety boat driver",
};

export interface UpgradeReport {
  typesAdded: number;
  typesUpdated: number;
  placesAdded: number;
  placesRenamed: number;
  coursesAdded: number;
  coursesAddedOff: number;
  ratiosUpdated: number;
  upcomingRatiosUpdated: number;
  safetyBoatOff: number;
  mapRows: number;
  linesConverted: number;
  safetyLinesRemoved: number;
  assignmentsConverted: number;
  assignmentsMerged: number;
  dayChangesConverted: number;
  openShiftsConverted: number;
  ratesCopied: number;
  rolesRetired: number;
  /** Upcoming items on a course with no instructor type linked: left on the generic place. */
  notConverted: number;
  /** True when everything converted and the centre is marked done. */
  complete: boolean;
  /** Already on instructor types, or not an RYA centre: nothing was looked at. */
  skipped?: string;
}

type Runnable = PromiseLike<unknown>;
const CHUNK = 40;

export async function upgradeInstructorTypes(
  repos: Repositories,
  ctx: AnyTenantContext,
  opts: { dryRun: boolean; today: string; activityType: string },
): Promise<UpgradeReport> {
  const report: UpgradeReport = {
    typesAdded: 0, typesUpdated: 0, placesAdded: 0, placesRenamed: 0, coursesAdded: 0, coursesAddedOff: 0, ratiosUpdated: 0, upcomingRatiosUpdated: 0,
    safetyBoatOff: 0, mapRows: 0, linesConverted: 0, safetyLinesRemoved: 0, assignmentsConverted: 0, assignmentsMerged: 0, dayChangesConverted: 0,
    openShiftsConverted: 0, ratesCopied: 0, rolesRetired: 0, notConverted: 0, complete: false,
  };
  if (opts.activityType !== "rya_centre") return { ...report, skipped: "Not an RYA centre" };
  const t = repos.tenant;
  const settings = (await t.orgSettings.list(ctx))[0];
  if (!settings) return { ...report, skipped: "No settings row" };
  if ((settings.teachingMapVersion ?? 0) >= TEACHING_MAP_VERSION) return { ...report, complete: true, skipped: "Already on instructor types" };

  const [types, roles, courseTypes, mapRows, payRates, quals, openShifts] = await Promise.all([
    t.qualificationType.list(ctx),
    t.roleType.list(ctx),
    t.courseType.list(ctx),
    t.qualificationCourseType.list(ctx),
    t.payRate.list(ctx),
    t.qualification.list(ctx),
    t.openShift.list(ctx),
  ]);
  const sessions = (await t.courseSession.list(ctx, gte(courseSessionTable.date, opts.today))).filter((s) => !s.cancelledAt);
  const upcomingCourseIds = [...new Set(sessions.map((s) => s.courseId))];
  const courses = (await t.course.listIn(ctx, courseTable.id, upcomingCourseIds)).filter((c) => c.status !== "cancelled");
  const courseIds = courses.map((c) => c.id);
  const [requirements, staff, overrides] = await Promise.all([
    t.courseRoleRequirement.listIn(ctx, courseRoleRequirementTable.courseId, courseIds),
    t.courseStaff.listIn(ctx, courseStaffTable.courseId, courseIds),
    t.sessionStaffOverride.listIn(ctx, sessionStaffOverrideTable.courseSessionId, sessions.map((s) => s.id)),
  ]);

  const phases: Runnable[][] = [];
  const phase = () => { const list: Runnable[] = []; phases.push(list); return list; };

  // --- 1. Instructor types -------------------------------------------------
  const typeOps = phase();
  type TypeMem = { id: string; name: string; code: string; discipline: string | null; rank: number; needsSupervision: boolean; supervises: boolean; active: boolean };
  const mem: TypeMem[] = types.map((q) => ({ id: q.id, name: q.name, code: q.code, discipline: q.discipline ?? null, rank: q.rank, needsSupervision: Boolean(q.needsSupervision), supervises: Boolean(q.supervises), active: Boolean(q.active) }));
  const codes = new Set(mem.map((q) => q.code));
  const claimed = new Set<string>();
  const typeIdForCode = new Map<string, string>();
  const find = (pred: (q: TypeMem) => boolean) => mem.find((q) => !claimed.has(q.id) && pred(q));
  for (const g of DEFAULT_GRADES) {
    const legacy = LEGACY_GRADES[g.code];
    const lower = (s: string) => s.trim().toLowerCase();
    const row = find((q) => q.code === g.code)
      ?? (legacy ? find((q) => q.code === legacy.code) : undefined)
      ?? find((q) => lower(q.name) === lower(g.name))
      ?? (legacy ? find((q) => lower(q.name) === lower(legacy.name)) : undefined);
    if (row) {
      claimed.add(row.id);
      const patch: Partial<Pick<TypeMem, "name" | "code" | "discipline" | "rank" | "needsSupervision" | "supervises">> = {};
      if (row.discipline !== (g.discipline ?? null)) patch.discipline = g.discipline ?? null;
      if (row.rank !== g.rank) patch.rank = g.rank;
      if (row.needsSupervision !== Boolean(g.needsSupervision)) patch.needsSupervision = Boolean(g.needsSupervision);
      if (row.supervises !== Boolean(g.supervises)) patch.supervises = Boolean(g.supervises);
      if (row.code !== g.code && !codes.has(g.code)) { codes.delete(row.code); codes.add(g.code); patch.code = g.code; }
      if (legacy && row.name === legacy.name && row.name !== g.name) patch.name = g.name;
      if (Object.keys(patch).length) {
        typeOps.push(t.qualificationType.updateStatement(ctx, row.id, patch));
        Object.assign(row, patch);
        report.typesUpdated++;
      }
      typeIdForCode.set(g.code, row.id);
    } else {
      let code = g.code;
      while (codes.has(code)) code = `${g.code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      codes.add(code);
      const id = crypto.randomUUID();
      const row2: TypeMem = { id, name: g.name, code, discipline: g.discipline ?? null, rank: g.rank, needsSupervision: Boolean(g.needsSupervision), supervises: Boolean(g.supervises), active: true };
      typeOps.push(t.qualificationType.insertStatement(ctx, { id, name: g.name, code, rank: g.rank, discipline: g.discipline ?? null, expiryTracked: g.expiryTracked, defaultValidMonths: g.defaultValidMonths ?? null, needsSupervision: row2.needsSupervision, supervises: row2.supervises, active: true }));
      mem.push(row2);
      claimed.add(id);
      typeIdForCode.set(g.code, id);
      report.typesAdded++;
    }
  }

  // --- 2. A place for every instructor type with a ladder ------------------
  const placeOps = phase();
  type RoleMem = { id: string; name: string; code: string; qualificationTypeId: string | null; active: boolean };
  const roleMem: RoleMem[] = roles.map((r) => ({ id: r.id, name: r.name, code: r.code, qualificationTypeId: r.qualificationTypeId ?? null, active: Boolean(r.active) }));
  const roleCodes = new Set(roleMem.map((r) => r.code));
  for (const q of mem.filter((x) => x.active && x.discipline)) {
    const place = roleMem.find((r) => r.qualificationTypeId === q.id);
    if (place) {
      if (place.name !== q.name) { placeOps.push(t.roleType.updateStatement(ctx, place.id, { name: q.name })); place.name = q.name; report.placesRenamed++; }
      continue;
    }
    let code = q.code;
    while (roleCodes.has(code)) code = `${q.code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    roleCodes.add(code);
    const id = crypto.randomUUID();
    placeOps.push(t.roleType.insertStatement(ctx, { id, name: q.name, code, countsTowardRatio: true, isSafetyCover: false, isFirstAider: false, active: true, qualificationTypeId: q.id }));
    roleMem.push({ id, name: q.name, code, qualificationTypeId: q.id, active: true });
    report.placesAdded++;
  }

  // --- 3. Course types: new ones, ratios, no safety-boat cover --------------
  const courseOps = phase();
  type CtMem = { id: string; name: string; scheme: string | null; requiresSafetyBoat: boolean };
  const ctMem: CtMem[] = courseTypes.map((c) => ({ id: c.id, name: c.name, scheme: c.scheme ?? null, requiresSafetyBoat: Boolean(c.requiresSafetyBoat) }));
  const running = new Set(courseTypes.filter((c) => c.active && c.listed).map((c) => c.scheme ?? ""));
  const ratioChange = new Map<string, { from: number; to: number }>();
  for (const seed of DEFAULT_COURSE_TYPES) {
    const row = courseTypes.find((c) => c.name.trim().toLowerCase() === seed.name.trim().toLowerCase());
    if (!row) {
      const id = crypto.randomUUID();
      const on = running.has(seed.scheme ?? "");
      courseOps.push(t.courseType.insertStatement(ctx, { ...seed, id, requiresSafetyBoat: false, active: on, listed: true }));
      ctMem.push({ id, name: seed.name, scheme: seed.scheme ?? null, requiresSafetyBoat: false });
      if (on) report.coursesAdded++; else report.coursesAddedOff++;
      continue;
    }
    const legacy = LEGACY_COURSE_DEFAULTS[seed.name];
    if (!legacy) continue;
    const patch: { studentsPerInstructor?: number; defaultCapacity?: number } = {};
    if (row.studentsPerInstructor === legacy.ratio && seed.studentsPerInstructor !== legacy.ratio) {
      patch.studentsPerInstructor = seed.studentsPerInstructor;
      ratioChange.set(row.id, { from: legacy.ratio, to: seed.studentsPerInstructor });
    }
    if (row.defaultCapacity === legacy.capacity && seed.defaultCapacity !== legacy.capacity) patch.defaultCapacity = seed.defaultCapacity;
    if (Object.keys(patch).length) { courseOps.push(t.courseType.updateStatement(ctx, row.id, patch)); report.ratiosUpdated += patch.studentsPerInstructor ? 1 : 0; }
  }
  for (const c of ctMem) {
    if (!c.requiresSafetyBoat) continue;
    courseOps.push(t.courseType.updateStatement(ctx, c.id, { requiresSafetyBoat: false }));
    c.requiresSafetyBoat = false;
    report.safetyBoatOff++;
  }
  for (const c of courses) {
    const change = ratioChange.get(c.courseTypeId);
    if (change && c.ratio === change.from) { courseOps.push(t.course.updateStatement(ctx, c.id, { ratio: change.to })); report.upcomingRatiosUpdated++; }
  }

  // --- 4. Who can teach what (only courses nobody has set) ------------------
  const mapOps = phase();
  const rules: TeachRule[] = mapRows.map((r) => ({ qualificationTypeId: r.qualificationTypeId, courseTypeId: r.courseTypeId, alsoRequiresTypeId: r.alsoRequiresTypeId ?? null, needsApproval: Boolean(r.needsApproval) }));
  const mapped = new Set(rules.map((r) => r.courseTypeId));
  const seedsByCourse = new Map<string, typeof RYA_TEACHING>();
  for (const s of RYA_TEACHING) seedsByCourse.set(s.course.toLowerCase(), [...(seedsByCourse.get(s.course.toLowerCase()) ?? []), s]);
  for (const c of ctMem) {
    if (mapped.has(c.id)) continue;
    for (const s of seedsByCourse.get(c.name.trim().toLowerCase()) ?? []) {
      const typeId = typeIdForCode.get(s.type);
      const also = s.alsoRequires ? typeIdForCode.get(s.alsoRequires) ?? null : null;
      if (!typeId || (s.alsoRequires && !also)) continue;
      mapOps.push(t.qualificationCourseType.insertStatement(ctx, { qualificationTypeId: typeId, courseTypeId: c.id, alsoRequiresTypeId: also, needsApproval: Boolean(s.needsApproval) }));
      rules.push({ qualificationTypeId: typeId, courseTypeId: c.id, alsoRequiresTypeId: also, needsApproval: Boolean(s.needsApproval) });
      report.mapRows++;
    }
  }

  // --- 5. Upcoming courses: generic places → instructor-type places ---------
  const convertOps = phase();
  const info = new Map<string, TypeInfo>(mem.map((q) => [q.id, { id: q.id, name: q.name, discipline: q.discipline, rank: q.rank, needsSupervision: q.needsSupervision, supervises: q.supervises }]));
  const byCourse = rulesByCourse(rules);
  const placeOfType = new Map(roleMem.filter((r) => r.active && r.qualificationTypeId).map((r) => [r.qualificationTypeId!, r.id]));
  const typeOfPlace = new Map(roleMem.filter((r) => r.qualificationTypeId).map((r) => [r.id, r.qualificationTypeId!]));
  const ctById = new Map(ctMem.map((c) => [c.id, c]));
  const generic = new Map<string, string>(); // role id → generic code
  for (const r of roleMem) {
    if (r.qualificationTypeId) continue;
    const code = Object.keys(GENERIC_NAMES).find((k) => k === r.code || GENERIC_NAMES[k] === r.name.trim().toLowerCase());
    if (code) generic.set(r.id, code);
  }
  const leadFor = (courseTypeId: string): string | null => {
    const typeId = defaultPlaceType(byCourse.get(courseTypeId), info, schemeDiscipline(ctById.get(courseTypeId)?.scheme ?? null));
    return typeId ? placeOfType.get(typeId) ?? null : null;
  };
  const targetFor = (code: string, courseTypeId: string): string | null => {
    const lead = leadFor(courseTypeId);
    if (!lead) return null;
    const ladder = info.get(typeOfPlace.get(lead) ?? "")?.discipline ?? null;
    const teaching = [...typesForCourse(byCourse.get(courseTypeId))].map((id) => info.get(id)).filter((x): x is TypeInfo => Boolean(x?.discipline && x.discipline === ladder));
    if (code === LEGACY_GENERIC_ROLE_CODES.senior) {
      const sup = teaching.filter((x) => x.supervises).sort((a, b) => a.rank - b.rank)[0];
      return (sup && placeOfType.get(sup.id)) || lead;
    }
    if (code === LEGACY_GENERIC_ROLE_CODES.assistant) {
      const asst = teaching.filter((x) => x.rank < 20).sort((a, b) => b.rank - a.rank)[0];
      return (asst && placeOfType.get(asst.id)) || lead;
    }
    return lead;
  };
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const usedPlaces = new Set<string>();

  // Role lines: merge into an existing line for the same place; safety boat lines go.
  const lineByCoursePlace = new Map<string, { id: string; count: number }>();
  for (const l of requirements) if (!generic.has(l.roleTypeId)) lineByCoursePlace.set(`${l.courseId}|${l.roleTypeId}`, { id: l.id, count: l.count });
  for (const l of requirements) {
    const code = generic.get(l.roleTypeId);
    if (!code) continue;
    if (code === LEGACY_GENERIC_ROLE_CODES.safetyBoat) { convertOps.push(t.courseRoleRequirement.deleteStatement(ctx, l.id)); report.safetyLinesRemoved++; continue; }
    const c = courseById.get(l.courseId);
    const target = c ? targetFor(code, c.courseTypeId) : null;
    if (!target) { report.notConverted++; continue; }
    usedPlaces.add(target);
    const key = `${l.courseId}|${target}`;
    const existing = lineByCoursePlace.get(key);
    if (existing) {
      existing.count = Math.min(50, existing.count + l.count);
      convertOps.push(t.courseRoleRequirement.updateStatement(ctx, existing.id, { count: existing.count }), t.courseRoleRequirement.deleteStatement(ctx, l.id));
    } else {
      convertOps.push(t.courseRoleRequirement.updateStatement(ctx, l.id, { roleTypeId: target }));
      lineByCoursePlace.set(key, { id: l.id, count: l.count });
    }
    report.linesConverted++;
  }

  // People on the whole course: one assignment per person per place.
  const assigned = new Set(staff.filter((a) => !generic.has(a.roleTypeId)).map((a) => `${a.courseId}|${a.instructorId}|${a.roleTypeId}`));
  for (const a of staff) {
    const code = generic.get(a.roleTypeId);
    if (!code) continue;
    const c = courseById.get(a.courseId);
    const target = c ? targetFor(code, c.courseTypeId) : null;
    if (!target) { report.notConverted++; continue; }
    usedPlaces.add(target);
    const key = `${a.courseId}|${a.instructorId}|${target}`;
    if (assigned.has(key)) { convertOps.push(t.courseStaff.deleteStatement(ctx, a.id)); report.assignmentsMerged++; continue; }
    assigned.add(key);
    convertOps.push(t.courseStaff.updateStatement(ctx, a.id, { roleTypeId: target }));
    report.assignmentsConverted++;
  }

  // One-day changes and open shifts on upcoming sessions.
  const sessionCourse = new Map(sessions.map((s) => [s.id, courseById.get(s.courseId)]));
  for (const o of overrides) {
    const code = generic.get(o.roleTypeId);
    if (!code) continue;
    const c = sessionCourse.get(o.courseSessionId);
    const target = c ? targetFor(code, c.courseTypeId) : null;
    if (!target) { report.notConverted++; continue; }
    usedPlaces.add(target);
    convertOps.push(t.sessionStaffOverride.updateStatement(ctx, o.id, { roleTypeId: target }));
    report.dayChangesConverted++;
  }
  for (const s of openShifts) {
    if (s.status !== "open" && s.status !== "offered") continue;
    const code = generic.get(s.roleTypeId);
    if (!code) continue;
    const c = sessionCourse.get(s.courseSessionId);
    if (!c) continue; // a past session's shift: left as it is
    const target = targetFor(code, c.courseTypeId);
    if (!target) { report.notConverted++; continue; }
    convertOps.push(t.openShift.updateStatement(ctx, s.id, { roleTypeId: target }));
    report.openShiftsConverted++;
  }

  // --- 6. Pay: copy the generic places' rates to the instructor-type places in use
  const rateOps = phase();
  const heldTypes = new Set(quals.map((q) => q.qualificationTypeId));
  for (const [placeId, typeId] of typeOfPlace) if (heldTypes.has(typeId) && placeOfType.get(typeId) === placeId) usedPlaces.add(placeId);
  const band = (code: string, rank: number) => (code === LEGACY_GENERIC_ROLE_CODES.assistant ? rank < 20 : code === LEGACY_GENERIC_ROLE_CODES.senior ? rank >= 40 : rank >= 20 && rank < 40);
  const rateKey = (r: { instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null }) => `${r.instructorId ?? ""}|${r.roleTypeId ?? ""}|${r.courseTypeId ?? ""}`;
  const haveRate = new Set(payRates.map((r) => rateKey({ instructorId: r.instructorId ?? null, roleTypeId: r.roleTypeId ?? null, courseTypeId: r.courseTypeId ?? null })));
  for (const r of payRates) {
    const code = r.roleTypeId ? generic.get(r.roleTypeId) : undefined;
    if (!code || code === LEGACY_GENERIC_ROLE_CODES.safetyBoat) continue;
    for (const placeId of usedPlaces) {
      const rank = info.get(typeOfPlace.get(placeId) ?? "")?.rank ?? 0;
      if (!band(code, rank)) continue;
      const key = rateKey({ instructorId: r.instructorId ?? null, roleTypeId: placeId, courseTypeId: r.courseTypeId ?? null });
      if (haveRate.has(key)) continue;
      haveRate.add(key);
      rateOps.push(t.payRate.insertStatement(ctx, { instructorId: r.instructorId ?? null, roleTypeId: placeId, courseTypeId: r.courseTypeId ?? null, rate: r.rate, ratePence: r.ratePence ?? Math.round(r.rate * 100), unit: r.unit }));
      report.ratesCopied++;
    }
  }

  // --- 7. Retire the generic places and mark the centre done ----------------
  const finishOps = phase();
  report.complete = report.notConverted === 0;
  for (const [roleId, code] of generic) {
    const role = roleMem.find((r) => r.id === roleId);
    if (!role?.active) continue;
    // The safety boat driver goes regardless; the others only once nothing upcoming still needs them.
    if (code !== LEGACY_GENERIC_ROLE_CODES.safetyBoat && !report.complete) continue;
    finishOps.push(t.roleType.updateStatement(ctx, roleId, { active: false }));
    report.rolesRetired++;
  }
  if (report.complete) finishOps.push(t.orgSettings.updateStatement(ctx, settings.id, { teachingMapVersion: TEACHING_MAP_VERSION }));
  const audit = auditStatement(repos, ctx, { action: "upgrade_instructor_types", entity: "org_settings", entityId: settings.id, after: { ...report } });
  if (audit) finishOps.push(audit);

  if (!opts.dryRun) {
    for (const list of phases) for (let i = 0; i < list.length; i += CHUNK) await runAtomic(repos.db, list.slice(i, i + CHUNK));
  }
  return report;
}

/**
 * Link the RYA course list's courses to the instructor types that teach them
 * (the course map), for each course nobody has set yet: after "add the
 * default courses", "restore my course list" or adding the RYA list to a
 * centre. Types are matched by code, courses by name; anything missing is
 * skipped. An RYA centre not yet upgraded is left alone. Returns how many
 * rows were added.
 */
export async function fillCourseMap(repos: Repositories, ctx: AnyTenantContext, activityType: string): Promise<number> {
  const t = repos.tenant;
  const [types, courseTypes, mapRows, settingsRows] = await Promise.all([t.qualificationType.list(ctx), t.courseType.list(ctx), t.qualificationCourseType.list(ctx), t.orgSettings.list(ctx)]);
  // An RYA centre still on the old generic places waits for the upgrade: half a map (old type codes) would block its instructors.
  if (activityType === "rya_centre" && (settingsRows[0]?.teachingMapVersion ?? 0) < TEACHING_MAP_VERSION) return 0;
  const idForCode = new Map(types.map((q) => [q.code, q.id]));
  const mapped = new Set(mapRows.map((r) => r.courseTypeId));
  const ops: Runnable[] = [];
  for (const c of courseTypes) {
    if (mapped.has(c.id)) continue;
    for (const s of RYA_TEACHING.filter((x) => x.course.toLowerCase() === c.name.trim().toLowerCase())) {
      const typeId = idForCode.get(s.type);
      const also = s.alsoRequires ? idForCode.get(s.alsoRequires) ?? null : null;
      if (!typeId || (s.alsoRequires && !also)) continue;
      ops.push(t.qualificationCourseType.insertStatement(ctx, { qualificationTypeId: typeId, courseTypeId: c.id, alsoRequiresTypeId: also, needsApproval: Boolean(s.needsApproval) }));
    }
  }
  for (let i = 0; i < ops.length; i += CHUNK) await runAtomic(repos.db, ops.slice(i, i + CHUNK));
  return ops.length;
}
