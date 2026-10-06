import { requireTenant } from "@/lib/tenant/require";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { FeatureRequestForm } from "@/components/office/FeatureRequestForm";
import { FeatureRequestBoard, type BoardCard } from "@/components/office/FeatureRequestBoard";
import { STATUS_INFO, STATUS_ORDER } from "@/lib/validation/feature-request";
import { Card } from "@/components/ui";
import { GuideLink } from "@/components/GuideLink";
import type { FeatureRequest } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Requests & ideas" };

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

/** Ask for a feature or report a problem, follow your own requests, and see (and back) what other centres have asked for. */
export default async function FeatureRequestsPage() {
  const { ctx, repos } = await requireTenant({ permission: "office.view", allowReadOnly: true });
  const fr = new FeatureRequestRepository(repos.db);
  let mine: (FeatureRequest & { votes: number })[] = [];
  let board: BoardCard[] = [];
  try {
    [mine, board] = await Promise.all([fr.listForCentre(ctx), fr.board(ctx)]);
  } catch {
    // the tables arrive with the next migration
  }
  const readOnly = Boolean(ctx.ghost);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-navy">Requests &amp; ideas</h1>
          <GuideLink topic="feature-requests" />
        </div>
        <p className="max-w-3xl text-sm text-slate-600">
          ActivityRoster is built around what centres need. Ask for a new feature, suggest a change or tell us about something that isn&rsquo;t working, then follow it from Submitted to Live. Below your own requests is the board of what every centre has asked for: say &ldquo;We need this too&rdquo; on the ones that matter to you, and we&rsquo;ll build around what centres vote for.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-navy">Send a request</h2>
          {readOnly ? <p className="text-sm text-slate-500">Ghost Mode is read-only.</p> : <FeatureRequestForm />}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-lg font-semibold text-navy">My requests</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing sent yet. Your centre&rsquo;s requests appear here with their stage and any note from us.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {mine.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-navy">{r.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_INFO[r.status].tone}`}>{STATUS_INFO[r.status].label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {r.kind === "problem" ? "Problem" : "Feature"} · sent {fmtDate(r.createdAt)}{r.submitterName ? ` by ${r.submitterName}` : ""}
                      {r.status !== "submitted" && !r.hidden ? ` · 👍 ${r.votes} other ${r.votes === 1 ? "centre" : "centres"}` : ""}
                      {r.screenshotKey ? <> · <a href={`/api/feature-requests/${r.id}/screenshot`} target="_blank" rel="noreferrer" className="text-teal hover:underline">screenshot</a></> : null}
                    </p>
                    {r.publicTitle !== r.title && r.status !== "submitted" ? <p className="mt-1 text-xs text-slate-500">On the board as &ldquo;{r.publicTitle}&rdquo;</p> : null}
                    <p className="mt-1 text-xs text-slate-500">{STATUS_INFO[r.status].hint}</p>
                    {r.responseToCentre ? <p className="mt-1.5 rounded-lg bg-teal/5 px-3 py-2 text-xs text-slate-700"><strong className="text-navy">From ActivityRoster:</strong> {r.responseToCentre}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">The stages</h2>
            <ol className="space-y-1.5 text-xs text-slate-600">
              {STATUS_ORDER.map((s) => (
                <li key={s}><span className={`mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_INFO[s].tone}`}>{STATUS_INFO[s].label}</span>{STATUS_INFO[s].hint}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold text-navy">All requests from centres</h2>
        <p className="mb-3 text-sm text-slate-500">Every request we&rsquo;ve reviewed, by stage. Only the title is shown: never the details, screenshots or which centre asked. The most-needed are at the top of each column.</p>
        <FeatureRequestBoard items={board} readOnly={readOnly} />
      </section>
    </div>
  );
}
