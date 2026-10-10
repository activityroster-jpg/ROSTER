import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { LINKEDIN_META, parseLinkedinContacts, topRanks } from "@/lib/marketing";
import { LinkedinBoard, type LinkedinRow } from "@/components/admin/LinkedinBoard";
import { LINKEDIN_STATUSES } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "LinkedIn · Prospects" };

/**
 * Every prospect centre with its LinkedIn company page, the people found there
 * and where contact stands (not contacted, contacted with no response,
 * responded, rejected). Kept apart from the postal statuses on the Prospects list.
 */
export default async function LinkedinProspectsPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const prospects = await platform.listProspects(10_000, 0);
  const ranks = topRanks(prospects);
  const rows: LinkedinRow[] = prospects.map((p) => ({
    id: p.id,
    name: p.name,
    region: p.region ?? "",
    city: p.city ?? "",
    website: p.website ?? "",
    topRank: ranks.get(p.id) ?? null,
    pageUrl: p.linkedinUrl ?? "",
    contacts: parseLinkedinContacts(p.linkedinContacts),
    status: p.linkedinStatus ?? "not_contacted",
    checked: Boolean(p.linkedinCheckedAt),
  }));
  const withWebsite = rows.filter((r) => r.website).length;
  const checked = rows.filter((r) => r.checked).length;
  const counts = LINKEDIN_STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Outreach CRM</p>
          <h1 className="font-display text-2xl font-bold text-navy">LinkedIn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every centre, its LinkedIn page and the people to contact, with where things stand. The finder reads each centre&apos;s own
            website for LinkedIn links, 8 centres an hour, biggest first ({checked} of {withWebsite} websites read so far). It never visits
            LinkedIn itself, which LinkedIn&apos;s terms forbid, so use the search links to find the rest and add them here.
          </p>
        </div>
        <Link href="/admin/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal">← Prospects list</Link>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {counts.map(({ s, n }) => (
          <div key={s} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500">{LINKEDIN_META[s].label}</p>
            <p className="mt-0.5 text-xl font-semibold text-navy">{n}</p>
          </div>
        ))}
      </div>
      <LinkedinBoard rows={rows} />
    </div>
  );
}
