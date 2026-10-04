import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { trialEndsAt, trialState } from "@/lib/billing/trial";
import { CONTACT_LABEL, OTHER_LABEL, TEXT_QUESTIONS, USER_COUNT_LABEL } from "@/lib/validation/trial-survey";
import { extraTrialOf } from "@/lib/services/trial-survey";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trial feedback" };

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const day = (d: Date | number) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const TRIAL_WORDS = { paid: "On a paid plan", trial: "On trial", read_only: "Trial ended: read-only", locked: "Trial ended: locked" } as const;

export default async function TrialFeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const db = await getDb();
  const platform = new PlatformRepository(db);
  const fb = await platform.trialFeedbackById(id).catch(() => null);
  if (!fb) notFound();
  const org = await new ControlPlaneRepository(db).organisationById(fb.organisationId);
  const trialDays = (await platform.getPricing().catch(() => null))?.trialDays ?? 30;
  const state = org ? trialState(org, trialDays) : null;
  const ends = org ? trialEndsAt(org, trialDays) : null;
  const extra = extraTrialOf(fb);
  const expired = extra.expiresAt.getTime() < Date.now();

  const answers: [string, string][] = [
    ...TEXT_QUESTIONS.map((q) => [q.label, fb[q.key]] as [string, string]),
    [USER_COUNT_LABEL, String(fb.userCount)],
    [OTHER_LABEL, fb.otherFeedback || "(left blank)"],
  ];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/trial-feedback" className="text-sm text-teal hover:underline">← All trial feedback</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">{fb.centreName}</h1>
          <p className="text-sm text-slate-500">{fb.centreSlug} · answered {when(fb.createdAt)} · <Link href={`/admin/centres/${fb.organisationId}`} className="text-teal hover:underline">Open centre</Link></p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Free trial</h2>
          <p className="mt-1 text-sm text-slate-700">{state ? TRIAL_WORDS[state.kind] : "Centre not found"}{ends && state?.kind !== "paid" ? ` · ends ${day(ends)}` : ""}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Extra {fb.rewardDays}-day trial activated</dt>
            <dd className="text-slate-700">{when(extra.activatedAt)}</dd>
            <dt className="text-slate-500">{expired ? "Expired" : "Expires"}</dt>
            <dd className={expired ? "text-port" : "text-slate-700"}>{day(extra.expiresAt)}</dd>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{CONTACT_LABEL}</h2>
          {fb.contactOk ? (
            <p className="mt-1 text-sm"><span className="rounded-full bg-starboard/10 px-2 py-0.5 text-xs font-medium text-starboard">Yes</span>{fb.contactEmail ? <a href={`mailto:${fb.contactEmail}`} className="ml-2 text-teal hover:underline">{fb.contactEmail}</a> : null}</p>
          ) : (
            <p className="mt-1 text-sm"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">No</span> <span className="ml-1 text-xs text-slate-500">Don&rsquo;t contact them about these answers.</span></p>
          )}
          <p className="mt-1 text-xs text-slate-400">Answered {when(fb.contactAnsweredAt)}</p>
        </section>
      </div>

      <dl className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        {answers.map(([label, answer], i) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm font-semibold text-navy"><span className="text-slate-400">{i + 1}.</span> {label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
