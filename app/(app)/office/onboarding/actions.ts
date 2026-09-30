"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { getAuth } from "@/lib/auth";
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
import { linkInstructorUser } from "@/lib/services/invite";
import { apexDomain } from "@/lib/config";
import { serializeFeatures } from "@/lib/features";
import { DEFAULT_COURSE_TYPES, DEFAULT_GRADES } from "@/lib/seed/catalogue";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

type Result = { ok: boolean; error?: string };

function toCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "TYPE";
}

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
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };
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
      try {
        const auth = await getAuth();
        await auth.api.signInMagicLink({ body: { email: linked.email, callbackURL: `https://${organisation.slug}.${apexDomain()}/portal/welcome` }, headers: new Headers(await headers()) });
        invited = true;
      } catch (err) {
        console.error("[onboarding] invite email failed:", (err as Error).message);
      }
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

/** Add a custom qualification / instructor type ("job type") on the fly. */
export async function addQualificationTypeAction(input: {
  name: string;
  discipline?: string;
}): Promise<{ ok: boolean; error?: string; id?: string; name?: string; discipline?: string | null }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "Give the type a name" };

  const existing = await repos.tenant.qualificationType.list(ctx);
  if (existing.some((q) => q.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That type already exists" };
  }
  const codes = new Set(existing.map((q) => q.code));
  let code = toCode(name);
  while (codes.has(code)) code = `${code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const maxRank = existing.reduce((m, q) => Math.max(m, q.rank), 0);

  const created = await repos.tenant.qualificationType.insert(ctx, {
    name,
    code,
    rank: maxRank + 10,
    discipline: input.discipline?.trim() || null,
    expiryTracked: false,
    defaultValidMonths: null,
    active: true,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "qualification_type", entityId: created.id, after: { name } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  revalidatePath("/office/settings");
  return { ok: true, id: created.id, name: created.name, discipline: created.discipline ?? null };
}

/** Add any RYA default instructor types this centre is missing (by name). */
export async function addDefaultGradesAction(): Promise<{ ok: boolean; created: { id: string; name: string; discipline: string | null }[] }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const existing = await repos.tenant.qualificationType.list(ctx);
  const haveNames = new Set(existing.map((q) => q.name.trim().toLowerCase()));
  const haveCodes = new Set(existing.map((q) => q.code));
  const created: { id: string; name: string; discipline: string | null }[] = [];
  for (const g of DEFAULT_GRADES) {
    if (haveNames.has(g.name.toLowerCase())) continue;
    let code = g.code;
    while (haveCodes.has(code)) code = `${g.code}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    haveCodes.add(code);
    const row = await repos.tenant.qualificationType.insert(ctx, {
      ...g, code, defaultValidMonths: g.defaultValidMonths ?? null, active: true,
    });
    created.push({ id: row.id, name: row.name, discipline: row.discipline ?? null });
  }
  if (created.length) await writeAudit(repos, ctx, { action: "add_default_grades", entity: "qualification_type", after: { count: created.length } });
  revalidatePath("/office/onboarding");
  revalidatePath("/office/staff");
  revalidatePath("/office/settings");
  return { ok: true, created };
}

/** Add any RYA default course types this centre is missing (by name), activated. */
export async function addDefaultCoursesAction(): Promise<{ ok: boolean; created: { id: string; name: string; scheme: string | null; audience: string; category: string | null }[] }> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const existing = await repos.tenant.courseType.list(ctx);
  const haveNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const created: { id: string; name: string; scheme: string | null; audience: string; category: string | null }[] = [];
  for (const c of DEFAULT_COURSE_TYPES) {
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
