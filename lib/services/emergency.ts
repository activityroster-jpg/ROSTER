import { can } from "@/lib/auth/rbac";
import { fmtWallTime } from "@/lib/domain";
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
  const onDuty = [...people.values()].filter((p) => out.some((s) => s.staff.some((x) => x.instructorId === p.instructorId)));
  await writeAudit(repos, ctx, { action: "view_emergency_sheet", entity: "organisation", entityId: ctx.organisationId, after: { date: dateIso, people: onDuty.length, contactsShown } }).catch(() => {});
  const welfare = (await welfareForRange(repos, ctx, dateIso, addDays(dateIso, 1))).byDate.get(dateIso) ?? {};
  return { date: dateIso, sessions: out, onDuty, welfare, contactsShown };
}

export function sheetToCsv(sheet: DaySheet): string {
  const esc = (v: string | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date", "Course", "Slot", "Start", "End", "Locations", "Name", "Role", "Status", "Phone", "Under 18", "Emergency contact", "Emergency phone", "Relationship", "Guardian", "Guardian phone"]];
  const time = (ms: number) => fmtWallTime(ms);
  for (const s of sheet.sessions) for (const p of s.staff) {
    rows.push([sheet.date, s.courseName, s.slot, time(s.startAt), time(s.endAt), s.locations.join("; "), p.name, p.role, p.status, p.phone ?? "", p.under18 ? "yes" : "", p.emergencyName ?? "", p.emergencyPhone ?? "", p.emergencyRelationship ?? "", p.guardianName ?? "", p.guardianPhone ?? ""]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/** Today's date in London as YYYY-MM-DD. */
export function londonToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
