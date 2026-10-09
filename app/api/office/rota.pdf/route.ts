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
  // Most experienced first: the highest licence they hold, then how many they hold.
  const [quals, qualTypes] = await Promise.all([repos.tenant.qualification.list(ctx), repos.tenant.qualificationType.list(ctx)]);
  const rank = new Map(qualTypes.map((q) => [q.id, q.rank]));
  const seniority = new Map<string, number>();
  for (const q of quals) {
    const r = rank.get(q.qualificationTypeId) ?? 0;
    const prev = seniority.get(q.instructorId) ?? 0;
    seniority.set(q.instructorId, Math.max(Math.floor(prev / 1000) * 1000, r * 1000) + (prev % 1000) + 1);
  }
  const pdf = await renderRotaPdf({ centreName: organisation.name, title: bounds.title, days, template: { ...saved, range, orientation }, timeZone: settings?.timezone ?? "Europe/London", seniority });
  await writeAudit(repos, ctx, { action: "export_rota_pdf", entity: "roster_week", after: { range, from: bounds.from, days: bounds.days, orientation } });
  const name = `${ctx.slug}-rota-${range}-${bounds.from}.pdf`;
  return new Response(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
