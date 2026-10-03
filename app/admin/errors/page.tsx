import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getRepositories } from "@/lib/cf/bindings";
import { Card, StatusPill } from "@/components/ui";
import Link from "next/link";
import { ErrorStatus } from "@/components/admin/ErrorStatus";
import { GhostButton } from "@/components/admin/GhostButton";
import type { ErrorReport } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const when = (d: Date) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminErrorsPage() {
  await requirePlatformAdmin();
  const { control } = await getRepositories();
  const reports = await control.listErrorReports(300);

  // Bucket by centre (slug/name), newest centre first by most recent report.
  const buckets = new Map<string, { label: string; orgId: string | null; items: ErrorReport[] }>();
  for (const r of reports) {
    const key = r.organisationSlug ?? "(no centre / marketing site)";
    const b = buckets.get(key) ?? { label: key, orgId: r.organisationId ?? null, items: [] };
    b.items.push(r);
    if (!b.orgId && r.organisationId) b.orgId = r.organisationId;
    buckets.set(key, b);
  }
  const groups = [...buckets.values()];
  const openCount = reports.filter((r) => r.status !== "resolved").length;
  const cspCount = reports.filter((r) => r.digest === "csp-report-only").length;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Error log</h1>
      <p className="mb-6 text-sm text-slate-500">
        Issues users have reported, bucketed by centre. {openCount} open · {reports.length} total. You&apos;re also emailed each one.
        {cspCount ? <> {cspCount} {cspCount === 1 ? "is a" : "are"} browser CSP report{cspCount === 1 ? "" : "s"} (report-only policy — nothing was blocked; resolve them once reviewed).</> : null}
      </p>

      {groups.length === 0 ? (
        <Card><p className="text-sm text-slate-400">No errors reported. 🎉</p></Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <Card key={g.label} className="p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  {g.orgId ? <Link href={`/admin/centres/${g.orgId}`} className="font-semibold text-teal hover:underline">{g.label}</Link> : <h2 className="font-semibold text-navy">{g.label}</h2>}
                  {g.orgId ? <GhostButton orgId={g.orgId} /> : null}
                </div>
                <span className="text-xs text-slate-400">{g.items.length} report{g.items.length === 1 ? "" : "s"}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-navy">{r.message}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {r.userEmail ?? "not signed in"} · {r.path ?? "—"} · {when(r.createdAt)}
                          {r.digest ? ` · ref ${r.digest}` : ""}
                        </p>
                        {r.userAgent ? <p className="mt-0.5 truncate text-[11px] text-slate-300">{r.userAgent}</p> : null}
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <StatusPill tone={r.status === "resolved" ? "covered" : r.status === "seen" ? "attention" : "conflict"}>{r.status}</StatusPill>
                        <ErrorStatus id={r.id} status={r.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
