import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { parseProspectStatuses, stageOf } from "@/lib/marketing";
import { ProspectPipeline, type PipelineTile } from "@/components/admin/ProspectPipeline";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline · Prospects" };

/**
 * The outreach pipeline as a board: five columns, every centre a tile. Moving
 * a tile changes the same stage the Prospects list shows in its Status column.
 */
export default async function ProspectPipelinePage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const prospects = await platform.listProspects(10_000, 0);
  const tiles: PipelineTile[] = prospects.map((p) => {
    const statuses = parseProspectStatuses(p.statuses, p.status);
    return {
      id: p.id,
      name: p.name,
      region: p.region ?? "",
      city: p.city ?? "",
      stage: stageOf(statuses),
      engaged: Boolean(p.engagedAt),
      hasEmail: Boolean(p.email),
      hasLinkedin: Boolean(p.linkedinUrl),
    };
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Outreach CRM</p>
          <h1 className="font-display text-2xl font-bold text-navy">Pipeline board</h1>
          <p className="mt-1 text-sm text-slate-500">Drag a centre to another column to change its stage; the Status column on the Prospects list changes with it. Click a name to open its page and log what happened.</p>
        </div>
        <a href="/admin/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal">← Prospects list</a>
      </div>
      <ProspectPipeline tiles={tiles} />
    </div>
  );
}
