"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

type Result = { ok: boolean; error?: string };

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
