import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { ProspectsTable, type ProspectRow } from "@/components/admin/ProspectsTable";
import { ProspectTools } from "@/components/admin/ProspectTools";
import { PROSPECT_STATUS_META, PROSPECT_STATUS_ORDER, parseProspectStatuses } from "@/lib/marketing";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [prospects, total] = await Promise.all([
    platform.listProspects(PAGE_SIZE, (page - 1) * PAGE_SIZE),
    platform.countProspects(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
  }));

  const counts = PROSPECT_STATUS_ORDER.map((s) => ({ s, n: rows.filter((r) => r.statuses.includes(s)).length }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Marketing outreach</h1>
      <p className="mb-5 text-sm text-slate-500">
        Your prospect list of RYA centres &amp; clubs — track outreach, generate window-envelope letters, and filter every column.
        Load the real directory via <span className="font-medium text-navy">Import CSV</span> (RYA&apos;s public &ldquo;Find a Training Centre&rdquo; list).
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {counts.map(({ s, n }) => (
          <Card key={s} className="px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">{PROSPECT_STATUS_META[s].label}</p>
            <p className="mt-0.5 text-xl font-semibold text-navy">{n}</p>
          </Card>
        ))}
      </div>

      <ProspectTools hasRows={rows.length > 0} />

      {rows.length === 0 ? (
        <Card><p className="text-sm text-slate-400">No prospects yet. Use <span className="font-medium text-navy">Import CSV</span> to load the RYA directory, add one manually, or drop in a few example rows to see how it works.</p></Card>
      ) : (
        <>
          <ProspectsTable rows={rows} />
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? <Link href={`/admin/marketing?page=${page - 1}`} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-navy hover:bg-slate-50">← Previous</Link> : <span />}
              <span className="text-slate-500">Page {page} of {pages} · {total} total</span>
              {page < pages ? <Link href={`/admin/marketing?page=${page + 1}`} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-navy hover:bg-slate-50">Next →</Link> : <span />}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
