"use server";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";

import { escapeHtml, sendEmail } from "@/lib/mail";

import { notifyInstructor } from "@/lib/services/notifications";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant/require";
import { getAuth } from "@/lib/auth";
import { dobSchema, protectedContactsSchema, instructorSchema, complianceItemSchema, qualificationSchema } from "@/lib/validation/entities";
import { writeAudit } from "@/lib/services/audit";
import { idSchema } from "@/lib/validation/actions";
import { hasFreshStepUp } from "@/lib/auth/step-up-server";
import { deleteInstructorIfUnreferenced } from "@/lib/services/retire";
import { linkInstructorUser } from "@/lib/services/invite";
import { toggleOnboarding } from "@/lib/services/hr";
import { instructorCapState, capUpgradeMessage } from "@/lib/tenant/limits";
import { apexDomain } from "@/lib/config";
import { EMPLOYMENT_TYPES, PAY_UNITS, type EmploymentType, type PayUnit } from "@/lib/db/schema";
import { deletePayRate, setPayRate } from "@/lib/services/pay-rates";
import { applyRateToUnapprovedLines, rebuildHoursFromRoster } from "@/lib/services/hours";
import { z } from "zod";
import { plausibleStaffDob } from "@/lib/domain/age";
import { sealToken } from "@/lib/security/token-crypto";

/** Absolute URL to a centre's own subdomain (magic links must land on it, not the apex). */
function centreUrl(slug: string, path: string): string {
  return `https://${slug}.${apexDomain()}${path}`;
}

export type ActionState = { ok: boolean; error?: string; message?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Simplified staff onboarding (centre side): create the instructor, record the
 * courses they can teach and the licences/checks they need (as placeholder
 * records to upload against), and email them an invite to set up their account.
 */
export async function setupInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter the instructor's name" };

  // Hard tier cap: block adding past the Small Club limit (volunteers included).
  if ((await instructorCapState(repos, ctx, organisation)).full) {
    return { ok: false, error: capUpgradeMessage(organisation) };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const dobParsed = dobSchema.safeParse(formData.get("dateOfBirth"));
  if (!dobParsed.success) return { ok: false, error: "Enter their date of birth. It decides which working-hours rules and privacy protections apply." };
  if (!plausibleStaffDob(dobParsed.data)) return { ok: false, error: "That date of birth doesn't look right (staff must be between 13 and 90)." };
  const employmentType: EmploymentType = (EMPLOYMENT_TYPES as readonly string[]).includes(String(formData.get("employmentType")))
    ? (String(formData.get("employmentType")) as EmploymentType)
    : "employed";

  const courseIds = [...new Set(formData.getAll("course").map(String).filter(Boolean))];
  const qualIds = [...new Set(formData.getAll("qual").map(String).filter(Boolean))];
  const checkIds = [...new Set(formData.getAll("check").map(String).filter(Boolean))];

  const instructor = await repos.tenant.instructor.insert(ctx, { name, email, phone: null, employmentType, status: "active", dateOfBirth: dobParsed.data });

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
        await auth.api.signInMagicLink({ body: { email: linked.email, callbackURL: centreUrl(organisation.slug, "/portal/welcome") }, headers: new Headers(await headers()) });
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
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  const expiry = patch.expiryDate === undefined ? undefined : patch.expiryDate && ISO.test(patch.expiryDate) ? patch.expiryDate : null;

  let updated;
  if (kind === "compliance") {
    updated = await repos.tenant.complianceItem.update(ctx, itemId, {
      ...(expiry !== undefined ? { expiryDate: expiry } : {}),
      ...(patch.reference !== undefined ? { reference: await sealIfVetting(repos, ctx, itemId, patch.reference || null) } : {}),
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
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  const res = await toggleOnboarding(repos, ctx, itemId, done);
  if (!res) return { ok: false, error: "Not found" };
  return { ok: true };
}

/** Add an instructor. Authed (admin), Zod-validated, audited. */
export async function createInstructorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  const parsed = instructorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || "",
    employmentType: formData.get("employmentType") || "employed",
    status: "active",
  });
  if (!parsed.success) return { ok: false, error: "Please check the instructor details" };

  // Hard tier cap: block adding past the Small Club limit (volunteers included).
  if ((await instructorCapState(repos, ctx, organisation)).full) {
    return { ok: false, error: capUpgradeMessage(organisation) };
  }

  const created = await repos.tenant.instructor.insert(ctx, {
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    dateOfBirth: parsed.data.dateOfBirth || null,
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
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
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
    reference: await sealForType(repos, ctx, parsed.data.complianceTypeId, parsed.data.reference ?? null),
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
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!instructorId) return { ok: false, error: "Missing instructor" };

  const linked = await linkInstructorUser(repos, ctx, instructorId);
  if (!linked.ok) return { ok: false, error: linked.error };

  // Best-effort magic-link email so they can sign in and reach the portal.
  try {
    const auth = await getAuth();
    await auth.api.signInMagicLink({
      body: { email: linked.email, callbackURL: centreUrl(organisation.slug, "/portal/welcome") },
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
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
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

/** Approve someone who joined via the app's company code: they become active staff with portal access. */
export async function approveJoinRequestAction(instructorId: string): Promise<ActionState> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  const inst = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!inst || inst.status !== "pending") return { ok: false, error: "Request not found" };
  if ((await instructorCapState(repos, ctx, organisation)).full) return { ok: false, error: capUpgradeMessage(organisation) };
  await repos.tenant.instructor.update(ctx, inst.id, { status: "active" });
  if (inst.userId) await repos.control.setMembershipStatus(inst.userId, ctx.organisationId, "active");
  await writeAudit(repos, ctx, { action: "approve_join_request", entity: "instructor", entityId: inst.id, after: { email: inst.email } });
  await notifyInstructor(repos, ctx, inst.id, { title: "You're in — your centre approved your request", body: "Open the ActivityRoster app to see your roster, set your availability and upload your certs.", email: true });
  revalidatePath("/office/staff");
  return { ok: true, message: `${inst.name} approved` };
}

/** Decline a join request: removes the pending record and tells them. */
export async function declineJoinRequestAction(instructorId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  const inst = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!inst || inst.status !== "pending") return { ok: false, error: "Request not found" };
  if (inst.email) {
    await sendEmail({ to: inst.email, subject: "About your request to join on ActivityRoster", html: `<p>Hi ${escapeHtml(inst.name)},</p><p>The centre you asked to join didn't approve your request this time. If you think that's a mistake, please contact them directly.</p>` }).catch(() => {});
  }
  if (inst.userId) await repos.control.deleteMembership(inst.userId, ctx.organisationId);
  await repos.tenant.instructor.delete(ctx, inst.id);
  await writeAudit(repos, ctx, { action: "decline_join_request", entity: "instructor", entityId: inst.id, before: { email: inst.email } });
  revalidatePath("/office/staff");
  return { ok: true, message: `${inst.name} declined` };
}


const editSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200).or(z.literal("")),
  phone: z.string().trim().max(40),
  dateOfBirth: dobSchema.or(z.literal("")),
  employmentType: z.enum(EMPLOYMENT_TYPES),
});

/** Edit an instructor's name, email, phone or employment type. Audited. */
export async function updateInstructorAction(instructorId: string, input: { name: string; email: string; phone: string; employmentType: string; dateOfBirth?: string }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  const parsed = editSchema.safeParse({ ...input, dateOfBirth: input.dateOfBirth ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details" };
  if (parsed.data.dateOfBirth && !plausibleStaffDob(parsed.data.dateOfBirth)) return { ok: false, error: "That date of birth doesn't look right (staff must be between 13 and 90)." };
  const before = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!before) return { ok: false, error: "Instructor not found" };
  const patch = { name: parsed.data.name, email: parsed.data.email || null, phone: parsed.data.phone || null, employmentType: parsed.data.employmentType, dateOfBirth: parsed.data.dateOfBirth || before.dateOfBirth || null };
  await repos.tenant.instructor.update(ctx, instructorId, patch);
  await writeAudit(repos, ctx, { action: "update", entity: "instructor", entityId: instructorId, before: { name: before.name, email: before.email, phone: before.phone, employmentType: before.employmentType, dateOfBirth: before.dateOfBirth }, after: patch });
  revalidatePath("/office/staff");
  revalidatePath(`/office/staff/${instructorId}`);
  return { ok: true, message: "Saved" };
}

/**
 * Mark an instructor as left (inactive) or bring them back. Leavers keep their
 * history and hours but drop out of every picker and lose app access (their
 * membership is suspended, never deleted).
 */
/** Delete an instructor who was never rostered, paid, clocked or on leave; anyone else is marked as left instead. */
export async function deleteInstructorAction(instructorId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "staff.edit" });
  if (!idSchema.safeParse(instructorId).success) return { ok: false, error: "Not found" };
  const r = await deleteInstructorIfUnreferenced(repos, ctx, instructorId);
  if (r.outcome === "not_found") return { ok: false, error: "Not found" };
  if (r.outcome === "retired") return { ok: false, error: `${r.name} has a record here (${r.because}), so they can't be deleted. Mark them as left instead; Data & privacy has the erasure tools.` };
  revalidatePath("/office/staff");
  revalidatePath("/office/courses");
  return { ok: true, message: `${r.name} deleted` };
}

export async function setInstructorStatusAction(instructorId: string, status: "active" | "inactive"): Promise<ActionState> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "staff.edit" });
  if (status !== "active" && status !== "inactive") return { ok: false, error: "Invalid status" };
  const inst = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!inst || inst.status === "pending") return { ok: false, error: "Instructor not found" };
  if (status === "active" && inst.status !== "active" && (await instructorCapState(repos, ctx, organisation)).full) {
    return { ok: false, error: capUpgradeMessage(organisation) };
  }
  await repos.tenant.instructor.update(ctx, instructorId, { status, leftAt: status === "inactive" ? new Date() : null });
  if (inst.userId) await repos.control.setMembershipStatus(inst.userId, ctx.organisationId, status === "active" ? "active" : "suspended");
  await writeAudit(repos, ctx, { action: status === "inactive" ? "instructor_left" : "instructor_returned", entity: "instructor", entityId: instructorId });
  revalidatePath("/office/staff");
  revalidatePath(`/office/staff/${instructorId}`);
  revalidatePath("/office/courses");
  return { ok: true, message: status === "inactive" ? `${inst.name} marked as left` : `${inst.name} is back on the team` };
}

const rateSchema = z.object({
  roleTypeId: z.string().min(1).max(64).nullable(),
  unit: z.enum(PAY_UNITS),
  rate: z.number().min(0).max(100_000),
});

/** Set how an instructor is paid (default, or for one role). Refreshes unpriced payroll lines. */
export async function setPayRateAction(instructorId: string, input: { roleTypeId: string | null; unit: string; rate: number; /** Apply the new rate to unapproved lines dated on or after this day (YYYY-MM-DD); omit to leave existing lines alone. */ applyFrom?: string | null }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter an amount and how it's paid" };
  if (!(await repos.tenant.instructor.findById(ctx, instructorId))) return { ok: false, error: "Instructor not found" };
  if (parsed.data.roleTypeId && !(await repos.tenant.roleType.findById(ctx, parsed.data.roleTypeId))) return { ok: false, error: "Unknown role" };
  await setPayRate(repos, ctx, { instructorId, roleTypeId: parsed.data.roleTypeId, unit: parsed.data.unit as PayUnit, rate: parsed.data.rate });
  // Lines that had no rate pick this one up.
  await rebuildHoursFromRoster(repos, ctx);
  // A corrected rate reaches the unapproved lines it should have priced (approved ones keep their pay).
  const applyFrom = typeof input.applyFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.applyFrom) ? input.applyFrom : null;
  const applied = applyFrom ? await applyRateToUnapprovedLines(repos, ctx, instructorId, applyFrom) : 0;
  revalidatePath(`/office/staff/${instructorId}`);
  revalidatePath("/office/finance");
  return { ok: true, message: applied ? `Pay rate saved and applied to ${applied} unapproved line${applied === 1 ? "" : "s"} from ${applyFrom}` : "Pay rate saved" };
}

export async function deletePayRateAction(id: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const ok = await deletePayRate(repos, ctx, id);
  if (!ok) return { ok: false, error: "Rate not found" };
  revalidatePath("/office/staff");
  revalidatePath("/office/finance");
  return { ok: true, message: "Rate removed" };
}


/**
 * Guardian (under-18s) and emergency contact details. Stored sealed (AES-GCM)
 * and shown only on the admin staff page. The audit entry records that the
 * fields changed, never their values.
 */
export async function updateProtectedContactsAction(instructorId: string, input: unknown): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "protected.view" });
  const parsed = protectedContactsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details" };
  const before = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!before) return { ok: false, error: "Instructor not found" };
  const d = parsed.data;
  const seal = async (v: string | undefined) => (v && v.trim() ? await sealToken(v.trim()) : null);
  const patch = {
    guardianName: d.guardianName?.trim() || null,
    guardianPhone: await seal(d.guardianPhone),
    guardianEmail: await seal(d.guardianEmail),
    emergencyName: await seal(d.emergencyName),
    emergencyPhone: await seal(d.emergencyPhone),
    emergencyRelationship: d.emergencyRelationship?.trim() || null,
  };
  await repos.tenant.instructor.update(ctx, instructorId, patch);
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => (patch[k] ?? null) !== (before[k] ?? null));
  await writeAudit(repos, ctx, { action: "update_protected_contacts", entity: "instructor", entityId: instructorId, after: { fields: changed } });
  revalidatePath(`/office/staff/${instructorId}`);
  return { ok: true, message: "Saved" };
}

/**
 * Give an under-18 a "Parental permission to work" slot: a compliance item
 * (upload + date + verified flag) against a compliance type with code
 * PARENTAL_PERMISSION, created for the centre if it doesn't have one yet.
 */
export async function addParentalPermissionAction(instructorId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "protected.view" });
  const inst = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!inst) return { ok: false, error: "Instructor not found" };
  const types = await repos.tenant.complianceType.list(ctx);
  let type = types.find((t) => t.code === "PARENTAL_PERMISSION");
  if (!type) {
    type = await repos.tenant.complianceType.insert(ctx, { name: "Parental permission to work (under 18)", code: "PARENTAL_PERMISSION", mandatory: false, expiryTracked: true, active: true });
    await writeAudit(repos, ctx, { action: "create", entity: "compliance_type", entityId: type.id, after: { name: type.name } });
  }
  const existing = (await repos.tenant.complianceItem.list(ctx)).find((c) => c.instructorId === instructorId && c.complianceTypeId === type!.id);
  if (existing) return { ok: true, message: "Already on their record" };
  const item = await repos.tenant.complianceItem.insert(ctx, { instructorId, complianceTypeId: type.id, reference: null, expiryDate: null, verified: false });
  await writeAudit(repos, ctx, { action: "create", entity: "compliance_item", entityId: item.id, after: { type: type.name } });
  revalidatePath(`/office/staff/${instructorId}`);
  return { ok: true, message: "Added. Upload the signed permission and set its date." };
}

// --- Per-person data rights (P1-A) -------------------------------------------
import { anonymisePerson, setRestriction } from "@/lib/services/person-data";

/** Restrict processing (kept but not rostered or contacted) or lift it. Reason is recorded. */
export async function setRestrictionAction(instructorId: string, restricted: boolean, reason: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "data.export" });
  const r = (reason ?? "").trim().slice(0, 300);
  if (restricted && r.length < 3) return { ok: false, error: "Give a short reason (it goes in the change log)" };
  const row = await setRestriction(repos, ctx, instructorId, restricted, restricted ? r : null);
  if (!row) return { ok: false, error: "Not found" };
  revalidatePath(`/office/staff/${instructorId}`);
  revalidatePath("/office/staff");
  return { ok: true, message: restricted ? "Processing restricted" : "Restriction lifted" };
}

/** Anonymise a person: typed-name confirmation; irreversible. */
export async function anonymiseInstructorAction(instructorId: string, typedName: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "data.export" });
  const i = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!i) return { ok: false, error: "Not found" };
  if (typedName.trim().toLowerCase() !== i.name.trim().toLowerCase()) return { ok: false, error: "Type their name exactly as shown to confirm" };
  if (!(await hasFreshStepUp())) return { ok: false, error: "Enter your PIN again to anonymise (press the button again)." };
  const res = await anonymisePerson(repos, ctx, instructorId);
  if (!res.ok) return { ok: false, error: res.reason };
  revalidatePath(`/office/staff/${instructorId}`);
  revalidatePath("/office/staff");
  return { ok: true, message: "Anonymised. Roster and payroll history stays, attached to “Former staff member”." };
}

/** "Keep for another N months": restarts the retention clock on a former staff member's profile. */
export async function keepFormerStaffAction(instructorId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "data.export" });
  const i = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!i || i.status !== "inactive" || i.anonymisedAt) return { ok: false, error: "Only a former staff member's profile can be kept" };
  await repos.tenant.instructor.update(ctx, instructorId, { leftAt: new Date() });
  await writeAudit(repos, ctx, { action: "retention_keep", entity: "instructor", entityId: instructorId });
  revalidatePath(`/office/staff/${instructorId}`);
  return { ok: true, message: "Kept; the retention clock starts again from today" };
}

/** Vetting references (DBS and equivalent certificate numbers) are encrypted at rest. */
async function sealForType(repos: Repositories, ctx: AnyTenantContext, complianceTypeId: string, reference: string | null): Promise<string | null> {
  if (!reference) return null;
  const type = await repos.tenant.complianceType.findById(ctx, complianceTypeId);
  return type?.isVetting ? sealToken(reference) : reference;
}
async function sealIfVetting(repos: Repositories, ctx: AnyTenantContext, itemId: string, reference: string | null): Promise<string | null> {
  if (!reference) return null;
  const item = await repos.tenant.complianceItem.findById(ctx, itemId);
  return item ? sealForType(repos, ctx, item.complianceTypeId, reference) : reference;
}

// --- Roles and guardian access (P1-F) ---------------------------------------
import { inviteGuardian, revokeGuardian } from "@/lib/services/guardians";


/** Give an under-18's parent or guardian read-only access to their roster, recording the consent. */
export async function inviteGuardianAction(instructorId: string, consentNote: string): Promise<ActionState> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "protected.view" });
  const r = await inviteGuardian(repos, ctx, instructorId, (consentNote ?? "").trim().slice(0, 300));
  if (!r.ok) return { ok: false, error: r.error };
  try {
    const auth = await getAuth();
    await auth.api.signInMagicLink({ body: { email: r.email, callbackURL: centreUrl(organisation.slug, "/parent") }, headers: new Headers(await headers()) });
  } catch (err) { console.error("[guardian] magic link failed:", (err as Error).message); }
  revalidatePath(`/office/staff/${instructorId}`);
  return { ok: true, message: `Invitation sent to ${r.email}` };
}

export async function revokeGuardianAction(instructorId: string, linkId: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "protected.view" });
  const ok = await revokeGuardian(repos, ctx, linkId);
  revalidatePath(`/office/staff/${instructorId}`);
  return ok ? { ok: true, message: "Guardian access removed" } : { ok: false, error: "Not found" };
}
