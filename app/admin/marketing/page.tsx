import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { ProspectsTable, type ProspectRow } from "@/components/admin/ProspectsTable";
import { ProspectTools } from "@/components/admin/ProspectTools";
import Link from "next/link";
import { PIPELINE_META, PIPELINE_STAGES, letterPrinted, parseProspectStatuses, stageOf, topRanks } from "@/lib/marketing";
import { addressComplete } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/** Left border per stage on the pipeline strip (the board's column colours). */
const STRIP: Record<string, string> = {
  rejected: "border-l-port",
  none: "border-l-slate-300",
  ready: "border-l-slate-500",
  letter: "border-l-amber",
  flyer: "border-l-amber",
  booklet: "border-l-teal",
  signed_up: "border-l-starboard",
};

/**
 * The whole list is loaded at once (a few thousand rows at most) so the pipeline
 * counts, filters and sorting cover every prospect — not just one page. The
 * table pages on the client.
 */
export default async function AdminMarketingPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const prospects = await platform.listProspects(10_000, 0);
  const total = prospects.length;
  const ranks = topRanks(prospects);

  const rows: ProspectRow[] = prospects.map((p) => {
    const statuses = parseProspectStatuses(p.statuses, p.status);
    return {
    id: p.id,
    name: p.name,
    region: p.region ?? "",
    addressLine1: p.addressLine1 ?? "",
    city: p.city ?? "",
    postcode: p.postcode ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
    contactName: p.contactName ?? "",
    contactRole: p.contactRole ?? "",
    statuses,
    stage: stageOf(statuses),
    topRank: ranks.get(p.id) ?? null,
    topPick: p.topPick ?? null,
    engaged: Boolean(p.engagedAt),
    source: p.source,
    soleTrader: Boolean(p.soleTrader),
    lawfulBasis: p.lawfulBasis ?? "legitimate_interests",
    createdAt: p.createdAt instanceof Date ? p.createdAt.getTime() : Number(p.createdAt),
    };
  });

  const counts = PIPELINE_STAGES.map((s) => ({ s, n: rows.filter((r) => r.stage === s).length }));
  const contacted = rows.filter((r) => r.statuses.some((s) => s === "letter_sent" || s === "flyer_sent" || s === "booklet_sent" || s === "email_sent" || s === "called")).length;
  const topUnprinted = rows.filter((r) => r.topRank !== null && !letterPrinted(r.statuses) && !r.statuses.includes("rejected")).length;
  const engaged = rows.filter((r) => r.engaged && r.stage !== "signed_up" && r.stage !== "rejected").length;
  const signedUp = rows.filter((r) => r.stage === "signed_up").length;
  const incomplete = rows.filter((r) => !addressComplete(r)).length;

  const kpi = (label: string, value: number | string, sub?: string) => (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
      {sub ? <p className="text-[11px] text-white/50">{sub}</p> : null}
    </div>
  );

  return (
    <div>
      {/* Header band */}
      <div className="mb-6 overflow-hidden rounded-card bg-gradient-to-br from-navy to-[#0C6B74] p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/60">Outreach CRM</p>
            <h1 className="font-display text-2xl font-bold">Marketing outreach</h1>
            <p className="mt-2 text-sm text-white/80">
              Your prospect list of RYA centres &amp; clubs: tick what has gone out (several can apply), print window-envelope
              letters, draft emails, and filter any column. Click a centre to open its page and log what happened. LinkedIn has its own tab.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/admin/marketing/pipeline" className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25">Open the pipeline board →</Link>
              <Link href="/admin/marketing/linkedin" className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25">LinkedIn tab →</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {kpi("Prospects", total)}
            {kpi("Contacted", contacted)}
            {kpi("Top 250 to print", topUnprinted, "letter not printed")}
            {kpi("Engaged", engaged, "orange vibe")}
            {kpi("Signed up", signedUp)}
          </div>
        </div>
      </div>

      {/* Pipeline strip: the board's columns, in board order */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map(({ s, n }) => (
          <Link key={s} href={`/admin/marketing/pipeline#${s}`} className={`rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm hover:border-teal ${STRIP[s]}`} title="Open this column on the board">
            <p className="text-[11px] font-medium text-slate-500">{PIPELINE_META[s].label}</p>
            <p className="mt-0.5 text-xl font-semibold text-navy">{n}</p>
          </Link>
        ))}
      </div>

      {incomplete > 0 ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">
          <span>⚠</span>
          <span><strong>{incomplete}</strong> prospect{incomplete === 1 ? " has" : "s have"} an incomplete postal address — the Letter button is disabled for those until you add street, town and postcode.</span>
        </div>
      ) : null}

      <ProspectTools hasRows={rows.length > 0} />

      {rows.length === 0 ? (
        <Card><p className="text-sm text-slate-400">No prospects yet. Use <span className="font-medium text-navy">Import CSV</span> to load the RYA directory, add one manually, or drop in a few example rows to see how it works.</p></Card>
      ) : (
        <ProspectsTable rows={rows} />
      )}
    </div>
  );
}
