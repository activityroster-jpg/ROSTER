import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { TrialFeedbackTable, type FeedbackRow } from "@/components/admin/TrialFeedbackTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trial feedback" };

export default async function TrialFeedbackPage() {
  await requirePlatformAdmin();
  let rows: FeedbackRow[] = [];
  try {
    rows = (await new PlatformRepository(await getDb()).listTrialFeedback()).map((r) => ({
      id: r.id, centreName: r.centreName, centreSlug: r.centreSlug, organisationId: r.organisationId,
      mostUseful: r.mostUseful, leastUseful: r.leastUseful, wouldChange: r.wouldChange, missing: r.missing,
      featureRequest: r.featureRequest, userCount: r.userCount, otherFeedback: r.otherFeedback,
      contactOk: r.contactOk, contactEmail: r.contactOk ? r.contactEmail : null,
      contactAnsweredAt: r.contactAnsweredAt.toISOString(), createdAt: r.createdAt.toISOString(),
      extraTrialGrantedAt: r.extraTrialGrantedAt?.toISOString() ?? null,
    }));
  } catch { /* table arrives with the next migration */ }
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Trial feedback <span className="text-base font-normal text-slate-400">{rows.length} answered</span></h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">Answers to the trial-end survey. Each centre can answer once, and answering gives it another free month. Click a row to read the answers in full and, if you want, activate a further 30-day trial. Only contact people marked &ldquo;Happy to be contacted&rdquo;, using the email they gave.</p>
      <TrialFeedbackTable rows={rows} />
    </div>
  );
}
