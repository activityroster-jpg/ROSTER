import { requireTenant } from "@/lib/tenant/require";
import { exportOrganisationData } from "@/lib/services/export";
import { writeAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/** Download the whole centre's data as JSON (GDPR portability). Admin only. */
export async function GET() {
  const { ctx, repos } = await requireTenant({ permission: "data.export" });
  const data = await exportOrganisationData(repos, ctx);
  // Bulk exports are sensitive: always on the centre's own record.
  await writeAudit(repos, ctx, { action: "data_export", entity: "organisation", entityId: ctx.organisationId, after: { format: "json" } });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${ctx.slug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
