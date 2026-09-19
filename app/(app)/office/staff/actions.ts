"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructorSchema, complianceItemSchema, qualificationSchema } from "@/lib/validation/entities";
import { writeAudit } from "@/lib/services/audit";

export type ActionState = { ok: boolean; error?: string };

/** Add an instructor. Authed (admin), Zod-validated, audited. */
export async function createInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = instructorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    employmentType: formData.get("employmentType") || "employed",
    status: "active",
  });
  if (!parsed.success) return { ok: false, error: "Please check the instructor details" };

  const created = await repos.tenant.instructor.insert(ctx, {
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    employmentType: parsed.data.employmentType,
    status: parsed.data.status,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "instructor", entityId: created.id, after: created });
  revalidatePath("/office/staff");
  return { ok: true };
}

/** Record a compliance check for an instructor. */
export async function addComplianceItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = complianceItemSchema.safeParse({
    instructorId: formData.get("instructorId"),
    complianceTypeId: formData.get("complianceTypeId"),
    reference: formData.get("reference") || undefined,
    expiryDate: (formData.get("expiryDate") as string) || null,
    verified: formData.get("verified") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Please check the compliance details" };

  const created = await repos.tenant.complianceItem.insert(ctx, {
    instructorId: parsed.data.instructorId,
    complianceTypeId: parsed.data.complianceTypeId,
    reference: parsed.data.reference ?? null,
    expiryDate: parsed.data.expiryDate ?? null,
    verified: parsed.data.verified,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "compliance_item", entityId: created.id, after: created });
  revalidatePath("/office/staff");
  return { ok: true };
}

/** Record a grade/qualification for an instructor. */
export async function addQualificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = qualificationSchema.safeParse({
    instructorId: formData.get("instructorId"),
    qualificationTypeId: formData.get("qualificationTypeId"),
    certNo: formData.get("certNo") || undefined,
    expiryDate: (formData.get("expiryDate") as string) || null,
    verified: formData.get("verified") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Please check the grade details" };

  const created = await repos.tenant.qualification.insert(ctx, {
    instructorId: parsed.data.instructorId,
    qualificationTypeId: parsed.data.qualificationTypeId,
    certNo: parsed.data.certNo ?? null,
    expiryDate: parsed.data.expiryDate ?? null,
    verified: parsed.data.verified,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "qualification", entityId: created.id, after: created });
  revalidatePath("/office/staff");
  return { ok: true };
}
