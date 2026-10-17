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

  // Each list goes in as a few batched INSERTs rather than one round trip per
  // row: a new centre is ~300 rows, and every call to the database is a chance
  // for a dropped connection to leave the sign-up half-made.
  await repos.sessionSlot.insertMany(ctx, pack.slots.map((s) => ({ ...s, active: true })));

  const typeIdByCode = new Map<string, string>();
  const gradeRows = await repos.qualificationType.insertMany(
    ctx,
    pack.grades.map((g) => ({
      ...g,
      needsSupervision: Boolean(g.needsSupervision),
      supervises: Boolean(g.supervises),
      defaultValidMonths: g.defaultValidMonths ?? null,
      active: true,
    })),
  );
  for (const row of gradeRows) typeIdByCode.set(row.code, row.id);

  await repos.roleType.insertMany(ctx, pack.roles.map((r) => ({ ...r, active: true })));
  // One place per teaching instructor type: a course's places are "2 × Dinghy Instructor", not "2 × Instructor".
  if (pack.placesFromTypes) {
    await repos.roleType.insertMany(
      ctx,
      pack.grades
        .filter((g) => g.discipline)
        .map((g) => ({ name: g.name, code: g.code, countsTowardRatio: true, isSafetyCover: false, isFirstAider: false, qualificationTypeId: typeIdByCode.get(g.code)!, active: true })),
    );
  }
  await repos.complianceType.insertMany(ctx, pack.compliance(jurisdiction).map((c) => ({ ...c, isVetting: Boolean(c.isVetting), active: true })));
  await repos.equipmentType.insertMany(ctx, pack.equipment.map((e) => ({ ...e, active: true })));
  await repos.locationType.insertMany(ctx, pack.locationTypes.map((name) => ({ name, active: true })));

  const courseRows = await repos.courseType.insertMany(ctx, pack.courseTypes.map((ct) => ({ ...ct, active: true })));
  const courseIdByName = new Map<string, string>();
  for (const row of courseRows) courseIdByName.set(row.name, row.id);

  // Who can teach what (lib/packs/rya-teaching.ts): the centre can change it in Course setup.
  const teaching = (pack.teaching ?? []).map((rule) => {
    const qualificationTypeId = typeIdByCode.get(rule.type);
    const courseTypeId = courseIdByName.get(rule.course);
    if (!qualificationTypeId || !courseTypeId) throw new Error(`Teaching map: unknown ${qualificationTypeId ? "course" : "instructor type"} in ${rule.type} → ${rule.course}`);
    return {
      qualificationTypeId,
      courseTypeId,
      alsoRequiresTypeId: rule.alsoRequires ? typeIdByCode.get(rule.alsoRequires) ?? null : null,
      needsApproval: Boolean(rule.needsApproval),
    };
  });
  await repos.qualificationCourseType.insertMany(ctx, teaching);
}

/** Bumped when the course map or the instructor-type places change in a way existing centres must be brought up to (lib/services/instructor-types-upgrade.ts). */
export const TEACHING_MAP_VERSION = 1;
