import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { instructorCourseType as instructorCourseTypeTable, qualification as qualificationTable } from "@/lib/db/schema";
import { runAtomic } from "@/lib/db/batch";
import { deleteDocument } from "@/lib/r2";
import { auditStatement } from "./audit";

export type SetTypesResult =
  | { ok: true; added: number; removed: number; approvals: number }
  | { ok: false; error: string };

/**
 * Save the instructor types someone holds and the courses they're approved
 * for, from the tick boxes on their profile. Ticked types they don't hold yet
 * get a licence record (to upload a copy against); unticked ones they hold
 * lose theirs, with its uploaded copy. Only the centre's active types are
 * touched (a retired type someone still holds stays on their record).
 * Approvals replace the list. One all-or-nothing write, audited.
 */
export async function setInstructorTypes(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { instructorId: string; typeIds: readonly string[]; approvedCourseIds: readonly string[] },
): Promise<SetTypesResult> {
  const t = repos.tenant;
  const person = await t.instructor.findById(ctx, input.instructorId);
  if (!person) return { ok: false, error: "Not found" };
  const [types, held, courseTypes, approvals] = await Promise.all([
    t.qualificationType.list(ctx),
    t.qualification.list(ctx, eq(qualificationTable.instructorId, person.id)),
    t.courseType.list(ctx),
    t.instructorCourseType.list(ctx, eq(instructorCourseTypeTable.instructorId, person.id)),
  ]);
  const active = new Map(types.filter((q) => q.active).map((q) => [q.id, q]));
  const wanted = new Set(input.typeIds.filter((id) => active.has(id)));
  const heldTypes = new Set(held.map((q) => q.qualificationTypeId));
  const toAdd = [...wanted].filter((id) => !heldTypes.has(id));
  const toRemove = held.filter((q) => active.has(q.qualificationTypeId) && !wanted.has(q.qualificationTypeId));

  const validCourses = new Set(courseTypes.map((c) => c.id));
  const wantApproved = new Set(input.approvedCourseIds.filter((id) => validCourses.has(id)));
  const haveApproved = new Set(approvals.map((a) => a.courseTypeId));
  const dropApprovals = approvals.filter((a) => !wantApproved.has(a.courseTypeId));
  const addApprovals = [...wantApproved].filter((id) => !haveApproved.has(id));

  if (!toAdd.length && !toRemove.length && !dropApprovals.length && !addApprovals.length) return { ok: true, added: 0, removed: 0, approvals: wantApproved.size };

  const nameOf = (id: string) => types.find((q) => q.id === id)?.name ?? "Instructor type";
  const audit = auditStatement(repos, ctx, {
    action: "set_instructor_types",
    entity: "instructor",
    entityId: person.id,
    before: { types: [...heldTypes].filter((id) => active.has(id)).map(nameOf), approvals: haveApproved.size },
    after: { types: [...wanted].map(nameOf), approvals: wantApproved.size, added: toAdd.map(nameOf), removed: toRemove.map((q) => nameOf(q.qualificationTypeId)) },
  });
  await runAtomic(repos.db, [
    ...toAdd.map((qualificationTypeId) => t.qualification.insertStatement(ctx, { instructorId: person.id, qualificationTypeId, certNo: null, issueDate: null, expiryDate: null, verified: false })),
    ...toRemove.map((q) => t.qualification.deleteStatement(ctx, q.id)),
    ...dropApprovals.map((a) => t.instructorCourseType.deleteStatement(ctx, a.id)),
    ...addApprovals.map((courseTypeId) => t.instructorCourseType.insertStatement(ctx, { instructorId: person.id, courseTypeId })),
    ...(audit ? [audit] : []),
  ]);
  // The removed licences' uploaded copies go too (after the records, so a failed delete never leaves a record without its file).
  for (const q of toRemove) if (q.docKey) await deleteDocument(ctx, q.docKey).catch(() => {});
  return { ok: true, added: toAdd.length, removed: toRemove.length, approvals: wantApproved.size };
}

/** A ladder key for a centre's own instructor type ("Kayak Coach" → "kayak_coach"): its own ladder of one. */
export function ownLadder(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "own";
}

/**
 * Add an instructor type, and (when it has a ladder) its place on courses, in
 * one write: places are instructor types, so every teaching type can be put on
 * a course. A held certificate (no ladder: Safety Boat certificate) gets no
 * place. The code is made unique. Audited by the caller's action.
 */
export async function createInstructorType(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { name: string; code?: string; rank?: number; discipline?: string | null; expiryTracked?: boolean; defaultValidMonths?: number | null; needsSupervision?: boolean; supervises?: boolean },
): Promise<{ id: string; name: string; discipline: string | null; placeId: string | null }> {
  const t = repos.tenant;
  const existing = await t.qualificationType.list(ctx);
  const codes = new Set(existing.map((q) => q.code));
  const base = (input.code?.trim() || input.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")).slice(0, 40) || "TYPE";
  let code = base;
  while (codes.has(code)) code = `${base}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const id = crypto.randomUUID();
  const placeId = input.discipline ? crypto.randomUUID() : null;
  const roleCodes = new Set((await t.roleType.list(ctx)).map((r) => r.code));
  let roleCode = code;
  while (roleCodes.has(roleCode)) roleCode = `${code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  await runAtomic(repos.db, [
    t.qualificationType.insertStatement(ctx, { id, name: input.name.trim(), code, rank: input.rank ?? 20, discipline: input.discipline ?? null, expiryTracked: Boolean(input.expiryTracked), defaultValidMonths: input.defaultValidMonths ?? null, needsSupervision: Boolean(input.needsSupervision), supervises: Boolean(input.supervises), active: true }),
    ...(placeId ? [t.roleType.insertStatement(ctx, { id: placeId, name: input.name.trim(), code: roleCode, countsTowardRatio: true, isSafetyCover: false, isFirstAider: false, active: true, qualificationTypeId: id })] : []),
  ]);
  return { id, name: input.name.trim(), discipline: input.discipline ?? null, placeId };
}

/** Keep the places for an instructor type in step with it when it is renamed, retired or brought back. */
export async function syncPlacesForType(repos: Repositories, ctx: AnyTenantContext, typeId: string, patch: { name?: string; active?: boolean }): Promise<number> {
  const places = (await repos.tenant.roleType.list(ctx)).filter((r) => r.qualificationTypeId === typeId);
  if (!places.length) return 0;
  await runAtomic(repos.db, places.map((r) => repos.tenant.roleType.updateStatement(ctx, r.id, patch)));
  return places.length;
}
