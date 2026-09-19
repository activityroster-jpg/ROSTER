import type { Jurisdiction } from "@/lib/db/schema";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { TenantRepositories } from "@/lib/db/repositories";
import {
  DEFAULT_COURSE_TYPES,
  DEFAULT_EQUIPMENT_TYPES,
  DEFAULT_GRADES,
  DEFAULT_LOCATION_TYPES,
  DEFAULT_ROLES,
  DEFAULT_SLOTS,
  defaultComplianceTypes,
} from "./catalogue";

/**
 * Seed a freshly-provisioned centre with the RYA-aware defaults. Idempotency is
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
): Promise<void> {
  await repos.orgSettings.insert(ctx, {
    schedulingMode: "session",
    alertLeadDays: 30,
    currency: jurisdiction === "ireland" ? "EUR" : "GBP",
    timezone: jurisdiction === "ireland" ? "Europe/Dublin" : "Europe/London",
  });

  for (const s of DEFAULT_SLOTS) {
    await repos.sessionSlot.insert(ctx, { ...s, active: true });
  }
  for (const r of DEFAULT_ROLES) {
    await repos.roleType.insert(ctx, { ...r, active: true });
  }
  for (const g of DEFAULT_GRADES) {
    await repos.qualificationType.insert(ctx, {
      ...g,
      defaultValidMonths: g.defaultValidMonths ?? null,
      active: true,
    });
  }
  for (const c of defaultComplianceTypes(jurisdiction)) {
    await repos.complianceType.insert(ctx, { ...c, active: true });
  }
  for (const e of DEFAULT_EQUIPMENT_TYPES) {
    await repos.equipmentType.insert(ctx, { ...e, active: true });
  }
  for (const name of DEFAULT_LOCATION_TYPES) {
    await repos.locationType.insert(ctx, { name, active: true });
  }
  for (const ct of DEFAULT_COURSE_TYPES) {
    await repos.courseType.insert(ctx, { ...ct, active: true });
  }
}
