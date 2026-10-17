import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Growth → Jobs: how centres use "Recruit on Boaty Jobs" (free job posts on
 * boatyjobs.com, a perk of the plan). Counts only, no job or applicant details.
 */
export default async function AdminJobsPage() {
  await requirePlatformAdmin();
  const stats = await new PlatformRepository(await getDb()).jobStats();
  const last12 = stats.byMonth.slice(-12);
  const max = Math.max(1, ...last12.map((m) => m.published));
  const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const tiles = [
    { label: "Centres using Jobs", value: stats.centres, hint: "have published at least one job" },
    { label: "Applications received", value: stats.applications, hint: "reported by Boaty Jobs, all time" },
    { label: "Live now", value: stats.live, hint: "jobs on Boaty Jobs today" },
  ];
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Jobs</h1>
      <p className="mb-6 text-sm text-slate-500">Job posts centres publish to Boaty Jobs from &ldquo;Recruit on Boaty Jobs&rdquo;.</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-navy">{t.value.toLocaleString("en-GB")}</p>
            <p className="text-xs text-slate-500">{t.hint}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold text-navy">Jobs published per month</h2>
        {last12.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs published yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {last12.map((m) => (
              <li key={m.month} className="flex items-center gap-3 text-sm">
                <span className="w-20 flex-none text-slate-600">{monthLabel(m.month)}</span>
                <span className="h-3 rounded bg-teal" style={{ width: `${Math.max(4, (m.published / max) * 100)}%`, maxWidth: "70%" }} aria-hidden />
                <span className="tabular-nums text-navy">{m.published}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Counted by the month each job first went live. Renewals aren&apos;t counted again.</p>
      </Card>
    </div>
  );
}
