import { can } from "@/lib/auth/rbac";
import { and, gte, lt } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseSession as courseSessionTable } from "@/lib/db/schema";
import { openToken } from "@/lib/security/token-crypto";
import { isUnder18 } from "@/lib/domain/age";
import { writeAudit } from "./audit";
import { staffBySession } from "./session-staff";
import { addDays } from "./schedule";
import { liveSessions } from "@/lib/domain/sessions";
import { welfareForRange } from "./welfare";

export interface SheetPerson {
  instructorId: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  under18: boolean;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelationship: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  medicalNotes: string | null;
}
export interface SheetSession { courseName: string; slot: string; startAt: number; endAt: number; locations: string[]; staff: SheetPerson[] }
export interface DaySheet { date: string; sessions: SheetSession[]; onDuty: SheetPerson[]; welfare: Partial<Record<string, string>>; /** False when the viewer lacks "Emergency & guardian contacts": names and roles only. */ contactsShown: boolean }

/**
 * The emergency sheet: everyone on duty today with the contact details the
 * safety boat or clubhouse would need if something went wrong. Admin-only,
 * decrypts the sealed contacts, and every build of it is written to the
 * centre's change log. No student data is held, so none appears.
 */
export async function getDaySheet(repos: Repositories, ctx: AnyTenantContext, dateIso: string): Promise<DaySheet> {
  const t = repos.tenant;
  // Emergency and guardian contacts need their own office tick; the roster alone shows who is on duty.
  const contactsShown = "system" in ctx ? true : can(ctx, "protected.view");
  const [sessions, assignments, instructors, roles, courses, courseLocations, locations] = await Promise.all([
    t.courseSession.list(ctx, and(gte(courseSessionTable.date, dateIso), lt(courseSessionTable.date, addDays(dateIso, 1)))).then(liveSessions),
    t.courseStaff.list(ctx),
    t.instructor.list(ctx),
    t.roleType.list(ctx),
    t.course.list(ctx),
    t.courseLocation.list(ctx),
    t.location.list(ctx),
  ]);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const people = new Map<string, SheetPerson>();
  const person = async (id: string): Promise<SheetPerson | null> => {
    if (people.has(id)) return people.get(id)!;
    const i = instructors.find((x) => x.id === id);
    if (!i) return null;
    const p: SheetPerson = {
      instructorId: i.id, name: i.name, role: "", status: "", phone: i.phone, under18: isUnder18(i.dateOfBirth),
      emergencyName: contactsShown ? await openToken(i.emergencyName) : null, emergencyPhone: contactsShown ? await openToken(i.emergencyPhone) : null, emergencyRelationship: contactsShown ? i.emergencyRelationship : null,
      guardianName: contactsShown ? i.guardianName : null, guardianPhone: contactsShown ? await openToken(i.guardianPhone) : null,
      medicalNotes: contactsShown ? await openToken(i.medicalNotes) : null,
    };
    people.set(id, p);
    return p;
  };
  const membersBySession = await staffBySession(repos, ctx, sessions, assignments);
  const out: SheetSession[] = [];
  for (const s of sessions.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    const course = courseById.get(s.courseId);
    const staff: SheetPerson[] = [];
    for (const a of (membersBySession.get(s.id) ?? []).filter((m) => m.status !== "declined")) {
      const p = await person(a.instructorId);
      if (p) staff.push({ ...p, role: roleName.get(a.roleTypeId) ?? "Staff", status: a.status });
    }
    out.push({
      courseName: course?.name ?? "Course", slot: s.slot, startAt: s.startAt.getTime(), endAt: s.endAt.getTime(),
      locations: courseLocations.filter((cl) => cl.courseId === s.courseId).map((cl) => locName.get(cl.locationId)).filter((n): n is string => Boolean(n)),
      staff,
    });
  }
  const onDuty = [...people.values()].filter((p) => out.some((s) => s.staff.some((x) => x.instructorId === p.instructorId))).sort((a, b) => a.name.localeCompare(b.name));
  await writeAudit(repos, ctx, { action: "view_emergency_sheet", entity: "organisation", entityId: ctx.organisationId, after: { date: dateIso, people: onDuty.length, contactsShown } }).catch(() => {});
  const welfare = (await welfareForRange(repos, ctx, dateIso, addDays(dateIso, 1))).byDate.get(dateIso) ?? {};
  return { date: dateIso, sessions: out, onDuty, welfare, contactsShown };
}

/** One row per person on duty: who they are and who to call. No course details (the roster has those). */
export function sheetToCsv(sheet: DaySheet): string {
  const esc = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date", "Name", "Under 18", "Emergency contact", "Relationship", "Emergency phone", "Guardian", "Guardian phone", "Medical conditions"]];
  for (const p of sheet.onDuty) {
    rows.push([sheet.date, p.name, p.under18 ? "yes" : "", p.emergencyName ?? "", p.emergencyRelationship ?? "", p.emergencyPhone ?? "", p.guardianName ?? "", p.guardianPhone ?? "", p.medicalNotes ?? ""]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/** Today's date in London as YYYY-MM-DD. */
export function londonToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
