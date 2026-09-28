"use server";

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
import { serializeFeatures } from "@/lib/features";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

type Result = { ok: boolean; error?: string };

/** Save which optional features the centre wants, and how sessions are run. */
export async function setSetupPreferencesAction(input: {
  features: string[];
  slotStyle: string;
}): Promise<Result> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const features = serializeFeatures(input.features as OptionalFeature[]);
  const slotStyle: SlotStyle = (SLOT_STYLES as readonly string[]).includes(input.slotStyle)
    ? (input.slotStyle as SlotStyle)
    : "slots";

  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) {
    await repos.tenant.orgSettings.update(ctx, existing.id, { enabledFeatures: features, slotStyle });
  } else {
    await repos.tenant.orgSettings.insert(ctx, { enabledFeatures: features, slotStyle });
  }
  await writeAudit(repos, ctx, { action: "onboarding_set_preferences", entity: "org_settings", after: { features: input.features, slotStyle } });
  revalidatePath("/office");
  revalidatePath("/office/onboarding");
  return { ok: true };
}

/** Create a custom course type during onboarding (name + audience + optional category). */
export async function addCustomCourseAction(input: {
  name: string;
  audience: string;
  category?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the course a name" };
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
    requiresSafetyBoat: audience === "youth",
    active: true,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "course_type", entityId: created.id, after: { name, audience } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/courses");
  revalidatePath("/office/settings");
  return { ok: true, id: created.id };
}

/** Set which RYA course types this centre runs (activate selected, retire the rest). */
export async function setCoursesRunAction(activeIds: string[]): Promise<Result> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
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

/** Add a team member with the qualifications (instructor types) they hold. */
export async function addTeamMemberAction(input: {
  name: string;
  email?: string;
  employmentType: string;
  qualificationTypeIds: string[];
}): Promise<Result> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };

  const employmentType: EmploymentType = (EMPLOYMENT_TYPES as readonly string[]).includes(input.employmentType)
    ? (input.employmentType as EmploymentType)
    : "employed";

  const instructor = await repos.tenant.instructor.insert(ctx, {
    name,
    email: input.email?.trim() || null,
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

  await writeAudit(repos, ctx, { action: "create", entity: "instructor", entityId: instructor.id, after: { name, quals: input.qualificationTypeIds } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  return { ok: true };
}

/** Mark onboarding dismissed for this browser so the dashboard stops redirecting. */
export async function dismissOnboardingAction(): Promise<Result> {
  const jar = await cookies();
  jar.set(ONBOARDED_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true };
}
