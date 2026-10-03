import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { ProspectsTable, type ProspectRow } from "@/components/admin/ProspectsTable";
import { ProspectTools } from "@/components/admin/ProspectTools";
import { PROSPECT_STATUS_META, PROSPECT_STATUS_ORDER, parseProspectStatuses } from "@/lib/marketing";
import { addressComplete } from "@/lib/marketing";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  neutral: "border-l-slate-300",
  attention: "border-l-amber",
  teal: "border-l-teal",
  covered: "border-l-starboard",
  conflict: "border-l-port",
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

  const rows: ProspectRow[] = prospects.map((p) => ({
    id: p.id,
    name: p.name,
    region: p.region ?? "",
    addressLine1: p.addressLine1 ?? "",
    city: p.city ?? "",
    postcode: p.postcode ?? "",
    email: p.email ?? "",
    website: p.website ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    contactName: p.contactName ?? "",
    contactRole: p.contactRole ?? "",
    statuses: parseProspectStatuses(p.statuses, p.status),
    source: p.source,
    soleTrader: Boolean(p.soleTrader),
    lawfulBasis: p.lawfulBasis ?? "legitimate_interests",
    createdAt: p.createdAt instanceof Date ? p.createdAt.getTime() : Number(p.createdAt),
  }));

  const counts = PROSPECT_STATUS_ORDER.map((s) => ({ s, n: rows.filter((r) => r.statuses.includes(s)).length }));
  const contacted = rows.filter((r) => r.statuses.some((s) => s === "letter_sent" || s === "email_sent" || s === "linkedin_contacted" || s === "called")).length;
  const purchased = rows.filter((r) => r.statuses.includes("purchased")).length;
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
              Your prospect list of RYA centres &amp; clubs — track every touchpoint, generate window-envelope letters,
              draft emails and LinkedIn messages, and filter any column. Import the RYA &ldquo;Find a Training Centre&rdquo; directory as CSV.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {kpi("Prospects", total)}
            {kpi("Contacted", contacted)}
            {kpi("Purchased", purchased)}
          </div>
        </div>
      </div>

      {/* Pipeline strip */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map(({ s, n }) => (
          <div key={s} className={`rounded-lg border border-slate-200 border-l-4 bg-white px-3 py-2 shadow-sm ${TONE[PROSPECT_STATUS_META[s].tone]}`}>
            <p className="text-[11px] font-medium text-slate-500">{PROSPECT_STATUS_META[s].label}</p>
            <p className="mt-0.5 text-xl font-semibold text-navy">{n}</p>
          </div>
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
