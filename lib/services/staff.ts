import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { evaluateFit, type ComplianceRequirement, type HeldCompliance, type FitResult } from "@/lib/domain";
import type { Instructor } from "@/lib/db/schema";

export interface StaffWithFit {
  instructor: Instructor;
  fit: FitResult;
}

/**
 * List instructors with their fit-to-roster status, computed from the org's
 * mandatory compliance requirements and each instructor's held checks. This is
 * the compliance moat surfaced for the Staff screen — all reads are tenant
 * scoped through the repositories; the decision is the pure `evaluateFit`.
 */
export async function listStaffWithFit(
  repos: Repositories,
  ctx: AnyTenantContext,
): Promise<StaffWithFit[]> {
  const t = repos.tenant;
  const [instructors, complianceTypes, complianceItems, settingsRows] = await Promise.all([
    t.instructor.list(ctx),
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx),
    t.orgSettings.list(ctx),
  ]);

  const requirements: ComplianceRequirement[] = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({
      complianceTypeId: c.id,
      name: c.name,
      mandatory: c.mandatory,
      expiryTracked: c.expiryTracked,
    }));

  const heldByInstructor = new Map<string, HeldCompliance[]>();
  for (const item of complianceItems) {
    const arr = heldByInstructor.get(item.instructorId) ?? [];
    arr.push({ complianceTypeId: item.complianceTypeId, expiryDate: item.expiryDate ?? null });
    heldByInstructor.set(item.instructorId, arr);
  }

  const leadDays = settingsRows[0]?.alertLeadDays ?? 30;
  const now = Date.now();

  return instructors.map((instructor) => ({
    instructor,
    fit: evaluateFit(requirements, heldByInstructor.get(instructor.id) ?? [], now, leadDays),
  }));
}
