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
  });

  for (const s of pack.slots) {
    await repos.sessionSlot.insert(ctx, { ...s, active: true });
  }
  for (const r of pack.roles) {
    await repos.roleType.insert(ctx, { ...r, active: true });
  }
  for (const g of pack.grades) {
    await repos.qualificationType.insert(ctx, {
      ...g,
      defaultValidMonths: g.defaultValidMonths ?? null,
      active: true,
    });
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
  for (const ct of pack.courseTypes) {
    await repos.courseType.insert(ctx, { ...ct, active: true });
  }
}
