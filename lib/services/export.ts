import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext, TenantContext } from "@/lib/tenant/context";

/**
 * Export ALL of a centre's data as a single JSON object (GDPR data portability).
 * Every read is tenant scoped through the repositories, so an export can only
 * ever contain the caller's own org — never another's. Suspended centres retain
 * export access during the retention window (see the suspended page).
 */
export async function exportOrganisationData(
  repos: Repositories,
  ctx: TenantContext,
): Promise<Record<string, unknown>> {
  const org = await repos.control.organisationById(ctx.organisationId);
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    organisation: org,
  };

  // Every tenant table, scoped to this org.
  const tenant = repos.tenant as Record<string, { list: (c: TenantContext) => Promise<unknown[]> }>;
  for (const [name, repo] of Object.entries(tenant)) {
    out[name] = await repo.list(ctx);
  }
  // Third-party API keys never leave the server, encrypted or not.
  if (Array.isArray(out.integration)) {
    out.integration = (out.integration as Record<string, unknown>[]).map((r) => ({ ...r, token: r.token ? "[redacted]" : null }));
  }
  return out;
}

/**
 * Permanently erase a centre and all its tenant data (GDPR erasure). Deleting
 * the organisation cascades to every tenant-owned table via ON DELETE CASCADE.
 * Guarded: the caller must be an admin and must confirm by typing the slug.
 */
export async function eraseOrganisation(
  repos: Repositories,
  ctx: TenantContext,
  confirmationSlug: string,
): Promise<{ erased: boolean }> {
  if (ctx.role !== "admin") throw new Error("Only an admin can erase a centre");
  if (confirmationSlug !== ctx.slug) throw new Error("Confirmation slug does not match");
  return eraseOrganisationData(repos, ctx);
}

/**
 * The removal itself. Also used by the platform owner from the Dev Center once
 * a leaving centre's 90-day export window has closed (lib/services/leaving).
 */
export async function eraseOrganisationData(repos: Repositories, ctx: AnyTenantContext): Promise<{ erased: boolean }> {
  const org = await repos.control.organisationById(ctx.organisationId);
  if (!org) return { erased: false };

  // Delete tenant rows in dependency order so RESTRICT foreign keys between
  // tenant tables are satisfied, then remove the org (cascades membership).
  const t = repos.tenant;
  const order = [
    // 1. rows that reference courses / people / config
    t.courseStaff, t.courseEquipment, t.courseLocation, t.courseRoleRequirement, t.courseSession,
    t.hoursRecord, t.availability, t.payRate, t.rosterWeek,
    t.courseTypeStaffing, t.courseTypeEquipment,
    t.qualification, t.complianceItem,
    // 2. courses (reference courseType)
    t.course,
    // 3. resources (reference equipmentType / locationType)
    t.equipment, t.location,
    // 4. people (referenced by the above)
    t.instructor,
    // 5. config
    t.roleType, t.qualificationType, t.complianceType, t.equipmentType, t.locationType, t.courseType,
    // 6. standalone
    t.sessionSlot, t.orgSettings, t.notification,
  ];
  for (const repo of order) {
    await repo.deleteAllForOrg(ctx);
  }

  // The audit log is append-only while its centre exists (database triggers,
  // migration 0046). Deleting the organisation cascades to it, which the
  // trigger allows because the parent row is already gone.
  await repos.control.deleteOrganisation(ctx.organisationId);
  return { erased: true };
}
