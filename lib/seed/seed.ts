import type { Jurisdiction } from "@/lib/db/schema";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { TenantRepositories } from "@/lib/db/repositories";
import { RYA_CENTRE_PACK } from "@/lib/packs/rya";
import type { ActivityPack } from "@/lib/packs/types";

/**
 * Seed a freshly-provisioned centre with its activity pack's defaults (the RYA
 * centre pack unless told otherwise). Idempotency is
 * the caller's responsibility (run once, inside provisioning, keyed on the
 * Stripe event) — this simply writes the baseline config.
 *
 * Runs under a SystemTenantContext because provisioning happens without a
 * signed-in user (Stripe webhook). All writes still go through the tenant
 * repositories, so the org filter is applied exactly as for user traffic.
 */
export async function seedOrganisationDefaults(
  repos: TenantRepositories,
  ctx: SystemTenantContext,
  jurisdiction: Jurisdiction,
  pack: ActivityPack = RYA_CENTRE_PACK,
): Promise<void> {
  await repos.orgSettings.insert(ctx, {
    schedulingMode: "session",
    ...(pack.settings.slotStyle ? { slotStyle: pack.settings.slotStyle } : {}),
    alertLeadDays: 30,
    currency: jurisdiction === "ireland" ? "EUR" : "GBP",
    timezone: jurisdiction === "ireland" ? "Europe/Dublin" : "Europe/London",
    // Warn when an instructor is double-booked / unavailable — on by default.
    enforceConflictChecks: true,
    // Places are instructor types and the course map is seeded (below), so nothing to upgrade.
    teachingMapVersion: pack.teaching ? TEACHING_MAP_VERSION : 0,
  });

  for (const s of pack.slots) {
    await repos.sessionSlot.insert(ctx, { ...s, active: true });
  }
  const typeIdByCode = new Map<string, string>();
  for (const g of pack.grades) {
    const row = await repos.qualificationType.insert(ctx, {
      ...g,
      needsSupervision: Boolean(g.needsSupervision),
      supervises: Boolean(g.supervises),
      defaultValidMonths: g.defaultValidMonths ?? null,
      active: true,
    });
    typeIdByCode.set(g.code, row.id);
  }
  for (const r of pack.roles) {
    await repos.roleType.insert(ctx, { ...r, active: true });
  }
  // One place per teaching instructor type: a course's places are "2 × Dinghy Instructor", not "2 × Instructor".
  if (pack.placesFromTypes) {
    for (const g of pack.grades) {
      if (!g.discipline) continue;
      await repos.roleType.insert(ctx, { name: g.name, code: g.code, countsTowardRatio: true, isSafetyCover: false, isFirstAider: false, qualificationTypeId: typeIdByCode.get(g.code)!, active: true });
    }
  }
  for (const c of pack.compliance(jurisdiction)) {
    await repos.complianceType.insert(ctx, { ...c, isVetting: Boolean(c.isVetting), active: true });
  }
  for (const e of pack.equipment) {
    await repos.equipmentType.insert(ctx, { ...e, active: true });
  }
  for (const name of pack.locationTypes) {
    await repos.locationType.insert(ctx, { name, active: true });
  }
  const courseIdByName = new Map<string, string>();
  for (const ct of pack.courseTypes) {
    const row = await repos.courseType.insert(ctx, { ...ct, active: true });
    courseIdByName.set(ct.name, row.id);
  }
  // Who can teach what (lib/packs/rya-teaching.ts): the centre can change it in Course setup.
  for (const rule of pack.teaching ?? []) {
    const qualificationTypeId = typeIdByCode.get(rule.type);
    const courseTypeId = courseIdByName.get(rule.course);
    if (!qualificationTypeId || !courseTypeId) throw new Error(`Teaching map: unknown ${qualificationTypeId ? "course" : "instructor type"} in ${rule.type} → ${rule.course}`);
    await repos.qualificationCourseType.insert(ctx, {
      qualificationTypeId,
      courseTypeId,
      alsoRequiresTypeId: rule.alsoRequires ? typeIdByCode.get(rule.alsoRequires) ?? null : null,
      needsApproval: Boolean(rule.needsApproval),
    });
  }
}

/** Bumped when the course map or the instructor-type places change in a way existing centres must be brought up to (lib/services/instructor-types-upgrade.ts). */
export const TEACHING_MAP_VERSION = 1;
