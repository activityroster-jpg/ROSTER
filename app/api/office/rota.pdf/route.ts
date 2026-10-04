import { requireTenant } from "@/lib/tenant/require";
import { getRotaDays } from "@/lib/services/schedule";
import { writeAudit } from "@/lib/services/audit";
import { renderRotaPdf } from "@/lib/pdf/rota-pdf";
import { parseRotaTemplate, rangeBounds, ROTA_ORIENTATIONS, ROTA_RANGES, type RotaOrientation, type RotaRange } from "@/lib/rota/template";

export const dynamic = "force-dynamic";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * The roster as a real PDF. Uses the centre's saved template (Settings → Roster
 * PDF); `range` (day|week|month), `from` (YYYY-MM-DD) and `orientation` may
 * override it for one download. Admin only; each download is audited.
 */
export async function GET(req: Request) {
  const { ctx, repos, organisation } = await requireTenant({ permission: "rota.view" });
  const sp = new URL(req.url).searchParams;
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const saved = parseRotaTemplate(settings?.rotaTemplate);
  const rangeQ = sp.get("range");
  const range: RotaRange = rangeQ && (ROTA_RANGES as readonly string[]).includes(rangeQ) ? (rangeQ as RotaRange) : saved.range;
  const oQ = sp.get("orientation");
  const orientation: RotaOrientation = oQ && (ROTA_ORIENTATIONS as readonly string[]).includes(oQ) ? (oQ as RotaOrientation) : saved.orientation;
  const fromQ = sp.get("from");
  const bounds = rangeBounds(range, fromQ && ISO.test(fromQ) ? fromQ : londonToday());
  const days = await getRotaDays(repos, ctx, bounds.from, bounds.days);
  const pdf = await renderRotaPdf({ centreName: organisation.name, title: bounds.title, days, template: { ...saved, range, orientation }, timeZone: settings?.timezone ?? "Europe/London" });
  await writeAudit(repos, ctx, { action: "export_rota_pdf", entity: "roster_week", after: { range, from: bounds.from, days: bounds.days, orientation } });
  const name = `${ctx.slug}-rota-${range}-${bounds.from}.pdf`;
  return new Response(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
