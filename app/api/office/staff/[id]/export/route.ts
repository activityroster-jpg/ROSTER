import { requireTenant } from "@/lib/tenant/require";
import { exportPerson, personExportToCsv } from "@/lib/services/person-data";

export const dynamic = "force-dynamic";

/** Everything held about one person, as JSON (default) or CSV (?format=csv). Admin only; audited. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const { id } = await params;
  const data = await exportPerson(repos, ctx, id);
  if (!data) return new Response("Not found", { status: 404 });
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  const safe = String(data.person.name ?? "person").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person";
  const stamp = data.exportedAt.slice(0, 10);
  return new Response(csv ? personExportToCsv(data) : JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ctx.slug}-${safe}-${stamp}.${csv ? "csv" : "json"}"`,
      "Cache-Control": "no-store",
    },
  });
}
