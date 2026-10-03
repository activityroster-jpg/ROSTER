import Link from "next/link";
import { apexDomain } from "@/lib/config";
import { requireTenant } from "@/lib/tenant/require";
import { getRepositories } from "@/lib/cf/bindings";
import { OfficeSidebar } from "@/components/office/OfficeSidebar";
import { TwoFactorNudge } from "@/components/office/TwoFactorNudge";
import { GhostBanner } from "@/components/office/GhostBanner";
import { eq } from "drizzle-orm";
import { instructor as instructorTable } from "@/lib/db/schema";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organisation, trial } = await requireTenant({ role: "admin", allowReadOnly: true });
  let clockOn = false;
  let privacyUrl: string | null = null;

  // Nudge the admin to turn on 2FA once they've added staff (dismissible).
  let show2fa = false;
  // The shared admin login usually has no instructor record of its own; only
  // offer the instructor view when there is one to show.
  let hasInstructorRecord = false;
  try {
    const { control, tenant } = await getRepositories();
    const me = await control.userById(ctx.userId);
    if (me && !me.twoFactorEnabled) {
      show2fa = (await tenant.instructor.count(ctx)) >= 1;
    }
    hasInstructorRecord = (await tenant.instructor.count(ctx, eq(instructorTable.userId, ctx.userId))) > 0;
    const settings = (await tenant.orgSettings.list(ctx))[0];
    clockOn = Boolean(settings?.timeclockEnabled);
    privacyUrl = settings?.privacyNoticeUrl ?? null;
  } catch { show2fa = false; }

  // Billing nudge: failed payment, or where the free trial is.
  const sub = organisation.subscriptionStatus;
  let banner: { kind: "trial" | "pastdue" | "overdue" | "readonly" | "locked"; daysLeft: number } | null = null;
  if (sub === "past_due" || sub === "unpaid") banner = ctx.readOnly === "overdue" ? { kind: "overdue", daysLeft: 0 } : { kind: "pastdue", daysLeft: organisation.pastDueSince ? Math.max(0, 14 - Math.floor((Date.now() - organisation.pastDueSince.getTime()) / 86_400_000)) : 14 };
  else if (trial.kind === "trial") banner = { kind: "trial", daysLeft: trial.daysLeft };
  else if (trial.kind === "read_only") banner = { kind: "readonly", daysLeft: trial.daysUntilLock };
  else if (trial.kind === "locked") banner = { kind: "locked", daysLeft: 0 };

  return (
    <div className="flex min-h-screen bg-canvas">
      <OfficeSidebar orgName={organisation.name} clockOn={clockOn} hasInstructorRecord={hasInstructorRecord} />
      <div className="flex-1 overflow-x-hidden pt-14 lg:pt-0">
        {ctx.ghost ? <GhostBanner centreName={organisation.name} /> : null}
        {show2fa && !ctx.ghost ? <TwoFactorNudge /> : null}
        {banner?.kind === "pastdue" ? (
          <Link href="/office/billing" className="block bg-port/15 px-6 py-2 text-center text-sm font-medium text-port hover:bg-port/20">
            Your last payment failed — update your card within {banner.daysLeft} day{banner.daysLeft === 1 ? "" : "s"} to keep editing. Nothing is ever deleted. →
          </Link>
        ) : banner?.kind === "overdue" ? (
          <Link href="/office/billing" className="block bg-port/15 px-6 py-2 text-center text-sm font-medium text-port hover:bg-port/20">
            Your centre is read-only until the failed payment is fixed. Everything is still here and nothing will be deleted — update your card to carry on →
          </Link>
        ) : banner?.kind === "locked" ? (
          <Link href="/office/billing" className="block bg-port/15 px-6 py-2 text-center text-sm font-medium text-port hover:bg-port/20">
            Your free trial has ended and the centre is locked — choose a plan to carry on →
          </Link>
        ) : banner?.kind === "readonly" ? (
          <Link href="/office/billing" className="block bg-amber/25 px-6 py-2 text-center text-sm font-medium text-navy hover:bg-amber/30">
            Your free trial has ended — everything is read-only, and locks in {banner.daysLeft} day{banner.daysLeft === 1 ? "" : "s"}. Choose a plan →
          </Link>
        ) : banner?.kind === "trial" ? (
          <Link href="/office/billing" className="block bg-amber/15 px-6 py-2 text-center text-sm font-medium text-navy hover:bg-amber/20">
            {banner.daysLeft > 0
              ? `You're on a free trial — ${banner.daysLeft} day${banner.daysLeft === 1 ? "" : "s"} left. Add payment to keep your centre active →`
              : "Your free trial has ended — add payment to keep your centre active →"}
          </Link>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-400 sm:px-6">
          Privacy: {privacyUrl ? <><a href={privacyUrl} target="_blank" rel="noreferrer" className="hover:text-navy">{organisation.name}&rsquo;s notice</a> · </> : null}
          <a href={`https://${apexDomain()}/privacy`} target="_blank" rel="noreferrer" className="hover:text-navy">ActivityRoster&rsquo;s notice</a>
          {" · "}<a href={`https://${apexDomain()}/privacy-request`} target="_blank" rel="noreferrer" className="hover:text-navy">Data request or complaint</a>
        </footer>
      </div>
    </div>
  );
}
