import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { letterOrFlyerSent, outreachSentOn, parseProspectStatuses, stageOf } from "@/lib/marketing";
import { ProspectPipeline, type PipelineTile } from "@/components/admin/ProspectPipeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline · Prospects" };

/**
 * The outreach pipeline as a board: a column per furthest tick, every centre a tile. Moving
 * a tile changes the same stage the Prospects list shows in its Status column.
 */
export default async function ProspectPipelinePage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const [prospects, markers] = await Promise.all([platform.listProspects(10_000, 0), platform.outreachMarkers()]);
  const byProspect = new Map<string, typeof markers>();
  for (const m of markers) { const list = byProspect.get(m.prospectId); if (list) list.push(m); else byProspect.set(m.prospectId, [m]); }
  const isoDay = (d: Date | number | null | undefined) => (d == null ? null : new Date(d).toISOString().slice(0, 10));
  const tiles: PipelineTile[] = prospects.map((p) => {
    const statuses = parseProspectStatuses(p.statuses, p.status);
    const stage = stageOf(statuses);
    const sent = outreachSentOn(byProspect.get(p.id) ?? []);
    // No log entry (set by a bulk action or before the log existed): the last change to the record stands in.
    const fallback = isoDay(p.updatedAt ?? p.createdAt);
    return {
      id: p.id,
      name: p.name,
      region: p.region ?? "",
      city: p.city ?? "",
      stage,
      engaged: Boolean(p.engagedAt),
      hasEmail: Boolean(p.email),
      letter: letterOrFlyerSent(statuses),
      bookletSentOn: stage === "booklet" ? sent.booklet ?? fallback : null,
      emailSentOn: stage === "email" ? sent.email ?? fallback : null,
      websiteNeedsWork: Boolean(p.websiteNeedsWork),
    };
  });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Outreach CRM</p>
          <h1 className="font-display text-2xl font-bold text-navy">Pipeline board</h1>
          <p className="mt-1 text-sm text-slate-500">Drag a centre to another column to change its stage; the Status column on the Prospects list changes with it. Click a name to open its page and log what happened. Booklet and email tiles count the working days since they went: green under 5, orange 5 to 8, red after that.</p>
        </div>
        <a href="/admin/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal">← Prospects list</a>
      </div>
      <ProspectPipeline tiles={tiles} today={today} />
    </div>
  );
}
