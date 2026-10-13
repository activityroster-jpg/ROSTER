"use server";

import { sendInvite } from "@/lib/auth/invite-link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import {
  COURSE_AUDIENCES,
  EMPLOYMENT_TYPES,
  SLOT_STYLES,
  type CourseAudience,
  type EmploymentType,
  type OptionalFeature,
  type SlotStyle,
} from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";
import { createInstructorType, ownLadder, setCourseTeachers } from "@/lib/services/instructor-types";
import { courseTeachersSchema } from "@/lib/validation/actions";
import { linkInstructorUser } from "@/lib/services/invite";
import { serializeFeatures } from "@/lib/features";
import { packFor } from "@/lib/packs";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";
import { capUpgradeMessage, instructorCapState } from "@/lib/tenant/limits";

type Result = { ok: boolean; error?: string };

function toCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "TYPE";
}

/** Save which optional features the centre wants, and how sessions are run. */
export async function setSetupPreferencesAction(input: {
  features: string[];
  slotStyle: string;
  availabilityWeeksAhead?: number;
  staffManagedBy?: string;
}): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });
  const features = serializeFeatures(input.features as OptionalFeature[]);
  const slotStyle: SlotStyle = (SLOT_STYLES as readonly string[]).includes(input.slotStyle)
    ? (input.slotStyle as SlotStyle)
    : "slots";
  const availabilityWeeksAhead = Math.max(1, Math.min(26, Math.round(Number(input.availabilityWeeksAhead) || 4)));
  const staffManagedBy = input.staffManagedBy === "office" ? "office" : "staff";

  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) {
    await repos.tenant.orgSettings.update(ctx, existing.id, { enabledFeatures: features, slotStyle, availabilityWeeksAhead, staffManagedBy });
  } else {
    await repos.tenant.orgSettings.insert(ctx, { enabledFeatures: features, slotStyle, availabilityWeeksAhead, staffManagedBy });
  }
  await writeAudit(repos, ctx, { action: "onboarding_set_preferences", entity: "org_settings", after: { features: input.features, slotStyle, availabilityWeeksAhead, staffManagedBy } });
  revalidatePath("/office");
  revalidatePath("/office/onboarding");
  return { ok: true };
}

/** Create a custom course type during onboarding (name + audience + optional category). */
export async function addCustomCourseAction(input: {
  name: string;
  audience: string;
  category?: string;
  /** Who can teach it: required when the centre has instructor types. */
  teachers?: unknown;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the course a name" };
  const teachers = courseTeachersSchema.safeParse(input.teachers ?? []);
  if (!teachers.success) return { ok: false, error: "Please check who can teach it" };
  if (teachers.data.length === 0 && (await repos.tenant.qualificationType.list(ctx)).some((q) => q.active && q.discipline)) {
    return { ok: false, error: "Tick at least one instructor type who can teach it" };
  }
  const audience: CourseAudience = (COURSE_AUDIENCES as readonly string[]).includes(input.audience)
    ? (input.audience as CourseAudience)
    : "all";

  const created = await repos.tenant.courseType.insert(ctx, {
    name,
    scheme: input.category?.trim() || "Centre course",
    audience,
    category: input.category?.trim() || null,
    defaultCapacity: 8,
    studentsPerInstructor: 4,
    requiresSafetyBoat: false,
    active: true,
  });
  if (teachers.data.length) await setCourseTeachers(repos, ctx, created.id, teachers.data);
  await writeAudit(repos, ctx, { action: "create", entity: "course_type", entityId: created.id, after: { name, audience, teachers: teachers.data.length } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/courses");
  revalidatePath("/office/settings");
  return { ok: true, id: created.id };
}

/** Set which course types this centre runs (activate selected, retire the rest). */
export async function setCoursesRunAction(activeIds: string[]): Promise<Result> {
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });
  const all = await repos.tenant.courseType.list(ctx);
  const want = new Set(activeIds);
  for (const c of all) {
    const shouldBe = want.has(c.id);
    if (Boolean(c.active) !== shouldBe) await repos.tenant.courseType.update(ctx, c.id, { active: shouldBe });
  }
  await writeAudit(repos, ctx, { action: "onboarding_set_courses", entity: "course_type", after: { activeIds } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/courses");
  return { ok: true };
}

/**
 * Add a team member: the qualifications (instructor types) they hold, the
 * courses they're approved to teach, and — if an email is given — a portal
 * invite. Mirrors the simplified staff-tab flow (setupInstructorAction) so
 * onboarding and the Staff tab stay identical.
 */
export async function addTeamMemberAction(input: {
  name: string;
  email?: string;
  employmentType: string;
  qualificationTypeIds: string[];
  courseTypeIds?: string[];
}): Promise<{ ok: boolean; error?: string; invited?: boolean; message?: string }> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  // Same hard tier cap as the Staff tab.
  if ((await instructorCapState(repos, ctx, organisation)).full) {
    return { ok: false, error: capUpgradeMessage(organisation) };
  }
  const email = input.email?.trim().toLowerCase() || null;

  const employmentType: EmploymentType = (EMPLOYMENT_TYPES as readonly string[]).includes(input.employmentType)
    ? (input.employmentType as EmploymentType)
    : "employed";

  const instructor = await repos.tenant.instructor.insert(ctx, {
    name,
    email,
    phone: null,
    employmentType,
    status: "active",
  });

  const validQuals = new Set((await repos.tenant.qualificationType.list(ctx)).map((q) => q.id));
  for (const qid of input.qualificationTypeIds) {
    if (validQuals.has(qid)) {
      await repos.tenant.qualification.insert(ctx, {
        instructorId: instructor.id,
        qualificationTypeId: qid,
        certNo: null,
        issueDate: null,
        expiryDate: null,
        verified: false,
      });
    }
  }

  // Courses they're approved to teach (validated against this centre's types).
  const courseTypeIds = [...new Set(input.courseTypeIds ?? [])];
  if (courseTypeIds.length) {
    const validCourses = new Set((await repos.tenant.courseType.list(ctx)).map((c) => c.id));
    for (const cid of courseTypeIds) {
      if (validCourses.has(cid)) await repos.tenant.instructorCourseType.insert(ctx, { instructorId: instructor.id, courseTypeId: cid });
    }
  }

  await writeAudit(repos, ctx, { action: "create", entity: "instructor", entityId: instructor.id, after: { name, quals: input.qualificationTypeIds, courses: courseTypeIds.length } });

  // Invite: link a user + membership and email a magic sign-in link (best effort).
  let invited = false;
  if (email) {
    const linked = await linkInstructorUser(repos, ctx, instructor.id);
    if (linked.ok) {
      invited = (await sendInvite(repos, ctx, { email: linked.email, userId: linked.userId, kind: "instructor", centreName: organisation.name, slug: organisation.slug, callbackPath: "/welcome?next=/portal/welcome" })) !== "failed";
    }
  }

  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  return {
    ok: true,
    invited,
    message: invited
      ? `${name} added — invite emailed to ${email}`
      : email
        ? `${name} added — couldn't email the invite, resend from their profile`
        : `${name} added`,
  };
}

/**
 * Add the centre's own instructor type on the fly. It gets its own ladder and
 * a place on courses (places are instructor types), so it can be linked to
 * courses in Course setup and rostered.
 */
export async function addQualificationTypeAction(input: {
  name: string;
  discipline?: string;
}): Promise<{ ok: boolean; error?: string; id?: string; name?: string; discipline?: string | null }> {
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the type a name" };

  const existing = await repos.tenant.qualificationType.list(ctx);
  if (existing.some((q) => q.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That type already exists" };
  }
  const created = await createInstructorType(repos, ctx, { name, code: toCode(name), rank: 20, discipline: input.discipline?.trim() || ownLadder(name) });
  await writeAudit(repos, ctx, { action: "create", entity: "qualification_type", entityId: created.id, after: { name, place: Boolean(created.placeId) } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  revalidatePath("/office/settings");
  return { ok: true, id: created.id, name: created.name, discipline: created.discipline };
}

/** Add any of the centre's pack's instructor types it is missing (by name), each with its place on courses. */
export async function addDefaultGradesAction(): Promise<{ ok: boolean; created: { id: string; name: string; code: string; rank: number; discipline: string | null }[] }> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const pack = packFor(organisation.activityType);
  const existing = await repos.tenant.qualificationType.list(ctx);
  const haveNames = new Set(existing.map((q) => q.name.trim().toLowerCase()));
  const created: { id: string; name: string; code: string; rank: number; discipline: string | null }[] = [];
  for (const g of pack.grades) {
    if (haveNames.has(g.name.toLowerCase())) continue;
    const row = await createInstructorType(repos, ctx, { name: g.name, code: g.code, rank: g.rank, discipline: g.discipline ?? null, expiryTracked: g.expiryTracked, defaultValidMonths: g.defaultValidMonths ?? null, needsSupervision: g.needsSupervision, supervises: g.supervises });
    created.push({ id: row.id, name: row.name, code: g.code, rank: g.rank, discipline: row.discipline });
  }
  if (created.length) await writeAudit(repos, ctx, { action: "add_default_grades", entity: "qualification_type", after: { count: created.length } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  revalidatePath("/office/settings");
  return { ok: true, created };
}

/** Add any of the centre's pack's course types it is missing (by name), activated. */
export async function addDefaultCoursesAction(): Promise<{ ok: boolean; created: { id: string; name: string; scheme: string | null; audience: string; category: string | null }[] }> {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const pack = packFor(organisation.activityType);
  const existing = await repos.tenant.courseType.list(ctx);
  const haveNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const created: { id: string; name: string; scheme: string | null; audience: string; category: string | null }[] = [];
  for (const c of pack.courseTypes) {
    if (haveNames.has(c.name.toLowerCase())) continue;
    const row = await repos.tenant.courseType.insert(ctx, { ...c, active: true });
    created.push({ id: row.id, name: row.name, scheme: row.scheme, audience: row.audience, category: row.category ?? null });
  }
  if (created.length) await writeAudit(repos, ctx, { action: "add_default_courses", entity: "course_type", after: { count: created.length } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/courses");
  revalidatePath("/office/settings");
  return { ok: true, created };
}

/** Mark onboarding dismissed for this browser so the dashboard stops redirecting. */
export async function dismissOnboardingAction(): Promise<Result> {
  const jar = await cookies();
  jar.set(ONBOARDED_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
}
