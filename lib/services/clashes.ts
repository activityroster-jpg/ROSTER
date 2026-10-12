import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { elsewhereFor, type OtherSession } from "@/lib/domain/clash-note";
import { sessionsAround } from "./assignment";

/**
 * For one course: who is on another course during any of its sessions, and
 * which one ("Youth Stage 3 (Mon AM)"). Reads a fortnight either side of the
 * course, never the whole history. Tenant scoped.
 */
export async function busyElsewhereFor(repos: Repositories, ctx: AnyTenantContext, courseId: string): Promise<Map<string, string>> {
  const t = repos.tenant;
  const around = (await sessionsAround(repos, ctx, courseId)).filter((s) => !s.cancelledAt);
  const target = around.filter((s) => s.courseId === courseId);
  const otherIds = [...new Set(around.filter((s) => s.courseId !== courseId).map((s) => s.courseId))];
  if (target.length === 0 || otherIds.length === 0) return new Map();
  const [courses, staff] = await Promise.all([t.course.listIn(ctx, courseTable.id, otherIds), t.courseStaff.listIn(ctx, courseStaffTable.courseId, otherIds)]);
  const nameOf = new Map(courses.map((c) => [c.id, c.name ?? "another course"]));
  const staffOf = new Map<string, string[]>();
  for (const a of staff) if (a.status !== "declined") staffOf.set(a.courseId, [...(staffOf.get(a.courseId) ?? []), a.instructorId]);
  const others: OtherSession[] = around.filter((s) => s.courseId !== courseId).map((s) => ({ courseId: s.courseId, courseName: nameOf.get(s.courseId) ?? "another course", date: s.date, slot: s.slot, instructorIds: staffOf.get(s.courseId) ?? [] }));
  return elsewhereFor(target.map((s) => ({ date: s.date, slot: s.slot })), others);
}
