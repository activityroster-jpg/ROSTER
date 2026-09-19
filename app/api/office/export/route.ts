import { requireTenant } from "@/lib/tenant/require";
import { exportOrganisationData } from "@/lib/services/export";

export const dynamic = "force-dynamic";

/** Download the whole centre's data as JSON (GDPR portability). Admin only. */
export async function GET() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const data = await exportOrganisationData(repos, ctx);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${ctx.slug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
