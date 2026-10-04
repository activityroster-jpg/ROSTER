import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { surveyStatus } from "@/lib/services/trial-survey";
import { TrialSurveyForm } from "@/components/office/TrialSurveyForm";
import { Card } from "@/components/ui";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trial survey" };

const fmtDate = (d: Date | number) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export default async function TrialSurveyPage() {
  // Reachable while the centre is read-only or locked: answering is how it unlocks.
  const { ctx, organisation, trial, repos } = await requireTenant({ permission: "billing.manage", allowReadOnly: true });
  const answered = await new PlatformRepository(await getDb()).trialFeedbackForOrg(organisation.id).catch(() => null);
  const status = surveyStatus(trial, Boolean(answered));
  const me = ctx.ghost ? null : await repos.control.userById(ctx.userId);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Tell us about your trial</h1>
        <GuideLink topic="trial-survey" />
      </div>
      {status === "open" ? (
        <>
          <p className="mb-6 text-sm text-slate-600">
            Answer eight questions and we&rsquo;ll give you another month free. Your centre unlocks as soon as you send your answers, and everything you set up during the trial is still there. It takes about ten minutes.
          </p>
          <TrialSurveyForm defaultEmail={me?.email ?? ""} />
        </>
      ) : status === "answered" ? (
        <Card>
          <p className="text-sm text-slate-700">Thank you: your centre has already answered the survey{answered ? ` (on ${fmtDate(answered.createdAt)})` : ""}, and the free month was added then. It&rsquo;s one survey per centre.</p>
          <Link href="/office/billing" className="mt-3 inline-block text-sm font-medium text-teal hover:underline">Choose a plan in Billing →</Link>
        </Card>
      ) : status === "not_yet" ? (
        <Card>
          <p className="text-sm text-slate-700">The survey opens when your free trial ends{trial.kind === "trial" ? ` on ${fmtDate(trial.endsAt)}` : ""}. Answer it then and we&rsquo;ll give you another month free.</p>
        </Card>
      ) : (
        <Card><p className="text-sm text-slate-700">Your centre is on a paid plan, so there&rsquo;s no trial survey to take. Thank you for being with us.</p></Card>
      )}
    </div>
  );
}
