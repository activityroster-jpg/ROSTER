import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { RequestPlanner, type RequestRow } from "@/components/admin/RequestPlanner";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  await requirePlatformAdmin();
  let rows: RequestRow[] = [];
  try {
    rows = (await new FeatureRequestRepository(await getDb()).platformList()).map((r) => ({
      id: r.id, centreName: r.centreName, centreSlug: r.centreSlug, submitterName: r.submitterName,
      kind: r.kind, title: r.title, publicTitle: r.publicTitle, problem: r.problem, change: r.change,
      whoAffected: r.whoAffected, frequency: r.frequency, workaround: r.workaround, importance: r.importance, details: r.details,
      hasScreenshot: Boolean(r.screenshotKey), status: r.status, hidden: r.hidden, responseToCentre: r.responseToCentre,
      votes: r.votes, createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    // the tables arrive with the next migration
  }
  const waiting = rows.filter((r) => r.status === "submitted").length;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Feature requests</h1>
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Requests and problem reports from every centre. New ones sit in Submitted, private to the centre that sent them. Open a card to read the brief, tidy the public title, then move it to In review to put it on the board every centre sees (title, stage and vote count only). Each move emails the person who sent it, and the centre sees the new stage straight away.
        {waiting ? <strong className="text-navy"> {waiting} waiting to be read.</strong> : null}
      </p>
      <RequestPlanner requests={rows} />
    </div>
  );
}
