import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { complianceItem as complianceItemTable } from "@/lib/db/schema";
import { evaluateFit, type ComplianceRequirement, type HeldCompliance } from "@/lib/domain";
import { canFillPlace } from "@/lib/domain/teaching";
import { getTeachingContext, getTeachingMatrix, type TeachingContext } from "./teaching";
import { qualificationGap } from "./problems";

export interface PlaceRole { id: string; name: string; countsTowardRatio: boolean; qualificationTypeId: string | null }

/**
 * Is this person qualified for this place on this course? Two checks, the same
 * for a whole-course assignment, a one-day add and Auto-roster:
 *   1. A teaching place (one that counts towards the ratio): they can teach the
 *      course type (the course map, lib/domain/teaching). Volunteers skip it.
 *   2. A place that is an instructor type: they hold it, or a higher type on the
 *      same ladder.
 * Returns the reason in plain words, or null when they're qualified. Both are
 * judged only once the centre has recorded something for them: with nothing on
 * file nobody is blocked.
 */
export async function placeQualificationIssue(
  repos: Repositories,
  ctx: AnyTenantContext,
  input: { instructorId: string; instructorName: string; courseTypeId: string; role: PlaceRole },
  pre?: TeachingContext,
): Promise<string | null> {
  const tc = pre ?? await getTeachingContext(repos, ctx);
  const held = tc.held.get(input.instructorId) ?? new Set<string>();
  if (input.role.countsTowardRatio) {
    const teaching = await getTeachingMatrix(repos, ctx, tc);
    const gap = qualificationGap(teaching.get(input.instructorId) ?? [], held.size > 0, input.courseTypeId);
    if (gap.known && !gap.qualified) {
      const ctName = (await repos.tenant.courseType.findById(ctx, input.courseTypeId))?.name ?? "this course type";
      return `${input.instructorName}'s instructor types don't cover ${ctName}`;
    }
  }
  // Like (1), only judged once something is on file for them: a centre that hasn't ticked anyone's types yet can still roster.
  if (input.role.qualificationTypeId && held.size > 0 && !canFillPlace(held, input.role.qualificationTypeId, tc.types)) {
    const typeName = tc.types.get(input.role.qualificationTypeId)?.name ?? input.role.name;
    return `${input.instructorName} isn't a ${typeName} (or higher on that ladder)`;
  }
  return null;
}

/** Mandatory checks missing or expired, when the centre has licence checks on. Null when fit (or checks are off). */
export async function fitIssue(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<string | null> {
  const t = repos.tenant;
  const [complianceTypes, items, settingsRows] = await Promise.all([
    t.complianceType.list(ctx),
    t.complianceItem.list(ctx, eq(complianceItemTable.instructorId, instructorId)),
    t.orgSettings.list(ctx),
  ]);
  const settings = settingsRows[0];
  if (!(settings?.enforceLicenceChecks ?? false)) return null;
  const requirements: ComplianceRequirement[] = complianceTypes.filter((c) => c.active).map((c) => ({ complianceTypeId: c.id, name: c.name, mandatory: c.mandatory, expiryTracked: c.expiryTracked }));
  const held: HeldCompliance[] = items.map((c) => ({ complianceTypeId: c.complianceTypeId, expiryDate: c.expiryDate ?? null }));
  const fit = evaluateFit(requirements, held, Date.now(), settings?.alertLeadDays ?? 30);
  if (fit.fit) return null;
  return `Not cleared to roster: ${fit.blocks.map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`)).join(", ")}`;
}
