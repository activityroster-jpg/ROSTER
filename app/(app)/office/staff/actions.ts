"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant/require";
import { getAuth } from "@/lib/auth";
import { instructorSchema, complianceItemSchema, qualificationSchema } from "@/lib/validation/entities";
import { writeAudit } from "@/lib/services/audit";
import { linkInstructorUser } from "@/lib/services/invite";
import { toggleOnboarding } from "@/lib/services/hr";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/db/schema";

export type ActionState = { ok: boolean; error?: string; message?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Simplified staff onboarding (centre side): create the instructor, record the
 * courses they can teach and the licences/checks they need (as placeholder
 * records to upload against), and email them an invite to set up their account.
 */
export async function setupInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter the instructor's name" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const employmentType: EmploymentType = (EMPLOYMENT_TYPES as readonly string[]).includes(String(formData.get("employmentType")))
    ? (String(formData.get("employmentType")) as EmploymentType)
    : "employed";

  const courseIds = [...new Set(formData.getAll("course").map(String).filter(Boolean))];
  const qualIds = [...new Set(formData.getAll("qual").map(String).filter(Boolean))];
  const checkIds = [...new Set(formData.getAll("check").map(String).filter(Boolean))];

  const instructor = await repos.tenant.instructor.insert(ctx, { name, email, phone: null, employmentType, status: "active" });

  // Courses they can teach (validated against active course types).
  const validCourses = new Set((await repos.tenant.courseType.list(ctx)).map((c) => c.id));
  for (const cid of courseIds) if (validCourses.has(cid)) await repos.tenant.instructorCourseType.insert(ctx, { instructorId: instructor.id, courseTypeId: cid });

  // Required licences (tickets) → placeholder qualification rows to upload against.
  const validQuals = new Set((await repos.tenant.qualificationType.list(ctx)).map((q) => q.id));
  for (const qid of qualIds) if (validQuals.has(qid)) {
    await repos.tenant.qualification.insert(ctx, { instructorId: instructor.id, qualificationTypeId: qid, certNo: null, issueDate: null, expiryDate: null, verified: false });
  }

  // Required checks (DBS/first aid/safeguarding) → placeholder compliance rows.
  const validChecks = new Set((await repos.tenant.complianceType.list(ctx)).map((c) => c.id));
  for (const cid of checkIds) if (validChecks.has(cid)) {
    await repos.tenant.complianceItem.insert(ctx, { instructorId: instructor.id, complianceTypeId: cid, reference: null, expiryDate: null, verified: false });
  }

  await writeAudit(repos, ctx, { action: "setup_instructor", entity: "instructor", entityId: instructor.id, after: { name, courses: courseIds.length, quals: qualIds.length, checks: checkIds.length } });

  // Invite: link a user + membership and email a magic sign-in link (best effort).
  let invited = false;
  if (email) {
    const linked = await linkInstructorUser(repos, ctx, instructor.id);
    if (linked.ok) {
      try {
        const auth = await getAuth();
        await auth.api.signInMagicLink({ body: { email: linked.email, callbackURL: "/portal/documents" }, headers: new Headers(await headers()) });
        invited = true;
      } catch (err) {
        console.error("[setup-instructor] invite email failed:", (err as Error).message);
      }
    }
  }

  revalidatePath("/office/staff");
  return { ok: true, message: invited ? `${name} added — invite emailed to ${email}` : email ? `${name} added — couldn't email the invite, you can resend from their profile` : `${name} added — add an email to invite them to upload documents` };
}

/** Update a licence/check's expiry, reference or verified flag (admin). */
export async function setDocMetaAction(kind: string, itemId: string, patch: { expiryDate?: string | null; reference?: string | null; verified?: boolean }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const expiry = patch.expiryDate === undefined ? undefined : patch.expiryDate && ISO.test(patch.expiryDate) ? patch.expiryDate : null;

  let updated;
  if (kind === "compliance") {
    updated = await repos.tenant.complianceItem.update(ctx, itemId, {
      ...(expiry !== undefined ? { expiryDate: expiry } : {}),
      ...(patch.reference !== undefined ? { reference: patch.reference || null } : {}),
      ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
    });
  } else {
    updated = await repos.tenant.qualification.update(ctx, itemId, {
      ...(expiry !== undefined ? { expiryDate: expiry } : {}),
      ...(patch.reference !== undefined ? { certNo: patch.reference || null } : {}),
      ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
    });
  }
  if (!updated) return { ok: false, error: "Record not found" };
  await writeAudit(repos, ctx, { action: "update_document_meta", entity: kind === "compliance" ? "compliance_item" : "qualification", entityId: itemId, after: patch });
  revalidatePath("/office/staff");
  revalidatePath("/portal/documents");
  return { ok: true };
}

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

  // Qualifications (instructor types) ticked on the form → qualification rows.
  const qualIds = formData.getAll("qual").map(String).filter(Boolean);
  if (qualIds.length) {
    const valid = new Set((await repos.tenant.qualificationType.list(ctx)).map((q) => q.id));
    for (const qid of qualIds) {
      if (valid.has(qid)) {
        await repos.tenant.qualification.insert(ctx, {
          instructorId: created.id,
          qualificationTypeId: qid,
          certNo: null,
          issueDate: null,
          expiryDate: null,
          verified: false,
        });
      }
    }
  }

  await writeAudit(repos, ctx, { action: "create", entity: "instructor", entityId: created.id, after: { ...created, quals: qualIds } });
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
