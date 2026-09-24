"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant/require";
import { getAuth } from "@/lib/auth";
import { instructorSchema, complianceItemSchema, qualificationSchema } from "@/lib/validation/entities";
import { writeAudit } from "@/lib/services/audit";
import { linkInstructorUser } from "@/lib/services/invite";
import { toggleOnboarding } from "@/lib/services/hr";

export type ActionState = { ok: boolean; error?: string; message?: string };

/** Tick/untick an onboarding step for a staff member. Admin only. */
export async function toggleOnboardingAction(itemId: string, done: boolean): Promise<{ ok: boolean; error?: string }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const res = await toggleOnboarding(repos, ctx, itemId, done);
  if (!res) return { ok: false, error: "Not found" };
  return { ok: true };
}

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

/** Invite an instructor to the portal: link their user + membership, email a
 *  magic sign-in link. */
export async function inviteInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!instructorId) return { ok: false, error: "Missing instructor" };

  const linked = await linkInstructorUser(repos, ctx, instructorId);
  if (!linked.ok) return { ok: false, error: linked.error };

  // Best-effort magic-link email so they can sign in and reach the portal.
  try {
    const auth = await getAuth();
    await auth.api.signInMagicLink({
      body: { email: linked.email, callbackURL: "/portal" },
      headers: new Headers(await headers()),
    });
  } catch (err) {
    console.error("[invite] magic link send failed:", (err as Error).message);
  }

  revalidatePath("/office/staff");
  return { ok: true, message: `Invite sent to ${linked.email}` };
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
