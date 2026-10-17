import { requireTenant } from "@/lib/tenant/require";
import { GuideLink } from "@/components/GuideLink";
import { RecruitBoard, type JobRow } from "@/components/office/RecruitBoard";
import { centreDetails, jobsWithPendingSync, listJobs } from "@/lib/services/jobs";
import { liveSlotsUsed, MAX_LIVE_JOBS, parseQualifications, postingAccess } from "@/lib/domain/jobs";

export const dynamic = "force-dynamic";

export const metadata = { title: "Recruit on Boaty Jobs" };

/**
 * Recruit on Boaty Jobs: the centre writes job posts here and they are
 * published on boatyjobs.com (a separate site, also run by ActiveRoster Ltd),
 * which emails applications straight to the centre. Free with any plan.
 */
export default async function RecruitPage() {
  const { ctx, repos, organisation, trial } = await requireTenant({ permission: "staff.edit" });
  const access = postingAccess({ orgStatus: organisation.status, subscriptionStatus: organisation.subscriptionStatus ?? null, trialKind: trial.kind, readOnly: Boolean(ctx.readOnly) });
  const [jobs, pending, centre, quals] = await Promise.all([
    listJobs(repos, ctx),
    jobsWithPendingSync(repos, ctx),
    centreDetails(repos, ctx, organisation),
    repos.tenant.qualificationType.list(ctx),
  ]);
  const prefix = organisation.activityType === "rya_centre" ? "RYA " : "";
  const qualOptions = [...new Set(quals.filter((q) => q.active !== false).map((q) => (q.name.startsWith(prefix) ? q.name : `${prefix}${q.name}`)))].sort();
  const rows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    roleType: j.roleType,
    employmentType: j.employmentType,
    positions: j.positions,
    startDate: j.startDate,
    endDate: j.endDate,
    payType: j.payType,
    payAmountGbp: j.payAmountGbp,
    accommodation: Boolean(j.accommodation),
    locationText: j.locationText,
    requiredQualifications: parseQualifications(j.requiredQualifications),
    description: j.description,
    closingDate: j.closingDate,
    applicationEmail: j.applicationEmail,
    status: j.status,
    listingId: j.listingId,
    publicUrl: j.publicUrl,
    expiresAt: j.expiresAt ? new Date(j.expiresAt).toISOString() : null,
    removedReason: j.removedReason,
    syncError: j.syncError,
    applicationsCount: j.applicationsCount,
    sending: pending.has(j.id),
  }));
  const defaultLocation = [centre.town, centre.postcode].filter(Boolean).join(", ");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Recruit on Boaty Jobs</h1>
        <GuideLink topic="recruit" />
      </div>
      <p className="mb-6 max-w-3xl text-sm text-slate-500">
        Advertise jobs to instructors outside your centre. Jobs you post here appear publicly on{" "}
        <a href="https://boatyjobs.com" target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">Boaty Jobs</a>
        {" "}(boatyjobs.com), a separate jobs site also run by ActiveRoster Ltd, and applications are emailed straight to you. Free with your plan:
        up to {MAX_LIVE_JOBS} live jobs at a time, each for up to 60 days.
      </p>
      <RecruitBoard
        jobs={rows}
        canPost={access.kind === "post"}
        readOnlyReason={access.kind === "read_only" ? access.reason : null}
        liveUsed={liveSlotsUsed(rows)}
        centre={{ town: centre.town, postcode: centre.postcode, region: centre.regionValue, regionLabel: centre.region, website: centre.website, logoUrl: centre.logoUrl, email: centre.email }}
        defaults={{ locationText: defaultLocation, applicationEmail: centre.email }}
        qualOptions={qualOptions}
      />
    </div>
  );
}
