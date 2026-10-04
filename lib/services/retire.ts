import { eq, or } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  complianceItem as complianceItemTable,
  courseEquipment as courseEquipmentTable,
  courseLocation as courseLocationTable,
  courseStaff as courseStaffTable,
  courseTypeEquipment as courseTypeEquipmentTable,
  equipment as equipmentTable,
  hoursRecord as hoursRecordTable,
  leaveRequest as leaveRequestTable,
  openShift as openShiftTable,
  qualification as qualificationTable,
  timeEntry as timeEntryTable,
} from "@/lib/db/schema";
import { writeAudit } from "./audit";
import { deleteDocument } from "@/lib/r2";

/**
 * Delete or retire (audit Part E, decision 8): an item nothing has ever
 * referenced can simply go; anything a course, a roster or a payslip has
 * pointed at is retired instead, so old records keep rendering
 * (deactivate-never-delete). Every outcome is audited.
 */
export type RetireOutcome = { outcome: "deleted"; name: string } | { outcome: "retired"; name: string; because: string } | { outcome: "not_found" };

export async function deleteOrRetireLocation(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<RetireOutcome> {
  const t = repos.tenant;
  const row = await t.location.findById(ctx, id);
  if (!row) return { outcome: "not_found" };
  const used = await t.courseLocation.count(ctx, eq(courseLocationTable.locationId, id));
  if (used > 0) {
    await t.location.update(ctx, id, { active: false });
    await writeAudit(repos, ctx, { action: "deactivate", entity: "location", entityId: id, after: { because: `used by ${used} course${used === 1 ? "" : "s"}` } });
    return { outcome: "retired", name: row.name, because: `${used} course${used === 1 ? " uses" : "s use"} it` };
  }
  await t.location.delete(ctx, id);
  await writeAudit(repos, ctx, { action: "delete", entity: "location", entityId: id, before: { name: row.name } });
  return { outcome: "deleted", name: row.name };
}

export async function deleteOrRetireEquipment(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<RetireOutcome> {
  const t = repos.tenant;
  const row = await t.equipment.findById(ctx, id);
  if (!row) return { outcome: "not_found" };
  const used = await t.courseEquipment.count(ctx, eq(courseEquipmentTable.equipmentId, id));
  if (used > 0) {
    await t.equipment.update(ctx, id, { status: "retired" });
    await writeAudit(repos, ctx, { action: "update_status", entity: "equipment", entityId: id, after: { status: "retired", because: `used by ${used} course${used === 1 ? "" : "s"}` } });
    return { outcome: "retired", name: row.name, because: `${used} course${used === 1 ? " uses" : "s use"} it` };
  }
  await t.equipment.delete(ctx, id);
  await writeAudit(repos, ctx, { action: "delete", entity: "equipment", entityId: id, before: { name: row.name } });
  return { outcome: "deleted", name: row.name };
}

export async function deleteOrRetireEquipmentType(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<RetireOutcome> {
  const t = repos.tenant;
  const row = await t.equipmentType.findById(ctx, id);
  if (!row) return { outcome: "not_found" };
  const [units, onCourses, onTypes] = await Promise.all([
    t.equipment.count(ctx, eq(equipmentTable.equipmentTypeId, id)),
    t.courseEquipment.count(ctx, eq(courseEquipmentTable.equipmentTypeId, id)),
    t.courseTypeEquipment.count(ctx, eq(courseTypeEquipmentTable.equipmentTypeId, id)),
  ]);
  const used = units + onCourses + onTypes;
  if (used > 0) {
    await t.equipmentType.update(ctx, id, { active: false });
    await writeAudit(repos, ctx, { action: "deactivate", entity: "equipment_type", entityId: id, after: { because: { units, onCourses, onTypes } } });
    const parts = [units ? `${units} unit${units === 1 ? "" : "s"}` : "", onCourses ? `${onCourses} course${onCourses === 1 ? "" : "s"}` : "", onTypes ? `${onTypes} course type${onTypes === 1 ? "" : "s"}` : ""].filter(Boolean);
    return { outcome: "retired", name: row.name, because: `${parts.join(", ")} still point at it` };
  }
  await t.equipmentType.delete(ctx, id);
  await writeAudit(repos, ctx, { action: "delete", entity: "equipment_type", entityId: id, before: { name: row.name } });
  return { outcome: "deleted", name: row.name };
}

/** What stops an instructor being deleted outright: anything that is a record of work. */
export async function instructorReferences(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<string[]> {
  const t = repos.tenant;
  const [rostered, hours, clock, leave, shifts] = await Promise.all([
    t.courseStaff.count(ctx, eq(courseStaffTable.instructorId, id)),
    t.hoursRecord.count(ctx, eq(hoursRecordTable.instructorId, id)),
    t.timeEntry.count(ctx, eq(timeEntryTable.instructorId, id)),
    t.leaveRequest.count(ctx, eq(leaveRequestTable.instructorId, id)),
    t.openShift.count(ctx, or(eq(openShiftTable.claimedByInstructorId, id), eq(openShiftTable.filledByInstructorId, id))),
  ]);
  const why: string[] = [];
  if (rostered) why.push(`rostered on ${rostered} course${rostered === 1 ? "" : "s"}`);
  if (hours) why.push(`${hours} payroll line${hours === 1 ? "" : "s"}`);
  if (clock) why.push(`${clock} clock record${clock === 1 ? "" : "s"}`);
  if (leave) why.push(`${leave} leave request${leave === 1 ? "" : "s"}`);
  if (shifts) why.push(`${shifts} open shift${shifts === 1 ? "" : "s"}`);
  return why;
}

/**
 * Delete an instructor who was never rostered, paid, clocked or on leave: their
 * profile, certs, documents, availability and login membership go. Anyone with
 * a record of work is not deleted here; the caller offers "mark as left" (and,
 * for GDPR erasure, the Data & privacy tools).
 */
export async function deleteInstructorIfUnreferenced(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<RetireOutcome> {
  const t = repos.tenant;
  const row = await t.instructor.findById(ctx, id);
  if (!row) return { outcome: "not_found" };
  const why = await instructorReferences(repos, ctx, id);
  if (why.length) return { outcome: "retired", name: row.name, because: why.join(", ") };
  const [quals, checks] = await Promise.all([t.qualification.list(ctx, eq(qualificationTable.instructorId, id)), t.complianceItem.list(ctx, eq(complianceItemTable.instructorId, id))]);
  for (const q of quals) if (q.docKey) await deleteDocument(ctx, q.docKey).catch(() => {});
  for (const c of checks) if (c.docKey) await deleteDocument(ctx, c.docKey).catch(() => {});
  await t.instructor.delete(ctx, id); // cascades certs, checks, availability, notes, notifications, pay rates, guardian links
  if (row.userId) {
    await repos.control.deleteMembership(row.userId, ctx.organisationId);
    await repos.control.deleteOrphanUser(row.userId);
  }
  await writeAudit(repos, ctx, { action: "delete", entity: "instructor", entityId: id, before: { name: row.name, hadLogin: Boolean(row.userId) } });
  return { outcome: "deleted", name: row.name };
}
