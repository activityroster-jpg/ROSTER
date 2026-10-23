import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository, type FunnelMilestones } from "@/lib/db/repositories/platform";
import { ONBOARDING_EMAIL_STEPS, type OnboardingEmail, type Organisation } from "@/lib/db/schema";
import { Card } from "@/components/ui";
import { addLeadToProspectsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funnel" };

const PERIODS = [{ days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "A year" }, { days: 0, label: "All time" }] as const;
const DAY = 86_400_000;
const STEP_LABEL: Record<(typeof ONBOARDING_EMAIL_STEPS)[number], string> = { welcome: "Welcome", courses: "Courses (day 2)", team: "Team (day 7)", trial_ending: "Trial ending" };

interface Stage { key: string; label: string; hint: string; n: number }

/**
 * Sign-ups from the first email to the first roster, counted from the data
 * itself (no analytics scripts, nothing on the client): the leads behind
 * them, and each new centre's welcome series. Privacy-safe by construction:
 * aggregates, plus the lead list we already hold.
 */
export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === sp.days) ? Number(sp.days) : 90;
  const since = days ? Date.now() - days * DAY : 0;
  const inPeriod = (d: Date | number | null | undefined) => (d == null ? false : (d instanceof Date ? d.getTime() : Number(d)) >= since);

  const platform = new PlatformRepository(await getDb());
  let orgs: Organisation[] = [], leads: Awaited<ReturnType<PlatformRepository["listLeads"]>> = [], prospects = new Set<string>();
  let owners = new Map<string, { userId: string; email: string; emailVerified: boolean }>(), milestones = new Map<string, FunnelMilestones>(), mails = new Map<string, OnboardingEmail[]>();
  try {
    [orgs, leads, prospects, owners, milestones, mails] = await Promise.all([platform.listOrganisations(), platform.listLeads(400), platform.prospectEmails(), platform.ownersByOrg(), platform.funnelMilestones(), platform.onboardingEmails()]);
  } catch { /* a table arrives with the next migration */ }

  const centres = orgs.filter((o) => inPeriod(o.createdAt)).sort((x, y) => (y.createdAt as Date).getTime() - (x.createdAt as Date).getTime());
  const ownerEmails = new Set([...owners.values()].map((o) => o.email.toLowerCase()));
  const periodLeads = leads.filter((l) => inPeriod(l.createdAt));
  const m = (o: Organisation): FunnelMilestones => milestones.get(o.id) ?? { instructors: 0, linked: 0, courses: 0, shifts: 0, confirmedDays: 0, officeRuns: false, actions: new Set() };
  const count = (f: (o: Organisation) => boolean) => centres.filter(f).length;
  const stages: Stage[] = [
    { key: "leads", label: "Email entered", hint: "a start box on the site, the pricing page or a landing page (demo tours are separate, below)", n: periodLeads.filter((l) => l.source !== "demo" && !l.source.startsWith("signup:")).length },
    { key: "created", label: "Centre created", hint: "password and centre name given; the centre exists", n: centres.length },
    { key: "verified", label: "Email confirmed", hint: "the owner clicked the confirmation link", n: count((o) => owners.get(o.id)?.emailVerified === true) },
    { key: "wizard", label: "Wizard: how you run saved", hint: "step 1 of the setup wizard", n: count((o) => m(o).actions.has("onboarding_set_preferences")) },
    { key: "courses_ticked", label: "Wizard: courses ticked", hint: "step 2", n: count((o) => m(o).actions.has("onboarding_set_courses")) },
    { key: "team", label: "Team added", hint: "at least one of their own instructors (the example week never counts)", n: count((o) => m(o).instructors > 0) },
    { key: "invited", label: "Team invited", hint: "an invite sent, or someone linked to the app", n: count((o) => m(o).linked > 0 || m(o).actions.has("invite_instructor")) },
    { key: "calendar", label: "Courses on the calendar", hint: "their own courses, by hand, import or booking system", n: count((o) => m(o).courses > 0) },
    { key: "roster", label: "First roster built", hint: "someone on a session", n: count((o) => m(o).shifts > 0) },
    { key: "confirmed", label: "First day confirmed", hint: "the team told", n: count((o) => m(o).confirmedDays > 0) },
    { key: "paying", label: "Plan chosen", hint: "a subscription, not a trial", n: count((o) => Boolean(o.subscriptionStatus && o.subscriptionStatus !== "trialing")) },
  ];
  const demoTours = periodLeads.filter((l) => l.source === "demo").length;
  const exampleLoaded = count((o) => m(o).actions.has("load_example_week"));
  const top = Math.max(1, ...stages.map((s) => s.n));
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "–");
  const fmt = (d: Date | number) => new Date(d instanceof Date ? d : Number(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-navy">Funnel</h1>
          <p className="max-w-3xl text-sm text-slate-500">From the first email to the first roster, counted from the centres&apos; own data: no analytics scripts, nothing on the client, nothing per person beyond the leads we already hold. Each stage is centres created in the period that have reached it.</p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-slate-200 p-0.5 text-xs">
          {PERIODS.map((p) => <Link key={p.days} href={`/admin/funnel?days=${p.days}`} className={`rounded-md px-2.5 py-1 font-semibold ${p.days === days ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{p.label}</Link>)}
        </nav>
      </div>

      <Card className="mb-6">
        <ol className="space-y-2">
          {stages.map((s, i) => {
            // Leads and centres aren't linked rows, so "Centre created" shows no share of "Email entered".
            const prev = i > 1 ? stages[i - 1]!.n : null;
            return (
              <li key={s.key} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.5rem_4rem] items-center gap-3 text-sm">
                <span><span className="font-medium text-navy">{s.label}</span><span className="block text-xs text-slate-400">{s.hint}</span></span>
                <span className="h-3 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-teal" style={{ width: `${Math.round((s.n / top) * 100)}%` }} /></span>
                <span className="text-right font-semibold tabular-nums text-navy">{s.n}</span>
                <span className="text-right text-xs tabular-nums text-slate-400" title={prev == null ? "" : "of the stage above"}>{prev == null ? "" : pct(s.n, prev)}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs text-slate-500">Also in the period: <strong className="text-navy">{demoTours}</strong> demo tour{demoTours === 1 ? "" : "s"} opened (email given, no password) · <strong className="text-navy">{exampleLoaded}</strong> centre{exampleLoaded === 1 ? "" : "s"} loaded the example week · <strong className="text-navy">{count((o) => (m(o).instructors > 0 && m(o).shifts === 0))}</strong> added a team but never rostered.</p>
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold text-navy">Welcome series</h2>
        <p className="mb-3 text-sm text-slate-500">Four emails to each new centre&apos;s owner in its first month (hourly job): welcome once their email is confirmed, courses on day 2, inviting the team on day 7, and the trial ending five days before. A step is skipped when it no longer applies.</p>
        {centres.length === 0 ? <p className="text-sm text-slate-400">No centres created in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1 pr-3">Centre</th><th className="py-1 pr-3">Created</th><th className="py-1 pr-3">Owner</th>{ONBOARDING_EMAIL_STEPS.map((s) => <th key={s} className="py-1 pr-3">{STEP_LABEL[s]}</th>)}<th className="py-1">Reached</th></tr></thead>
              <tbody>
                {centres.slice(0, 100).map((o) => {
                  const rows = mails.get(o.id) ?? [];
                  const mm = m(o);
                  const reached = stages.filter((s) => s.key !== "leads" && s.key !== "created").reverse().find((s) => (
                    s.key === "verified" ? owners.get(o.id)?.emailVerified : s.key === "wizard" ? mm.actions.has("onboarding_set_preferences") : s.key === "courses_ticked" ? mm.actions.has("onboarding_set_courses") : s.key === "team" ? mm.instructors > 0 : s.key === "invited" ? (mm.linked > 0 || mm.actions.has("invite_instructor")) : s.key === "calendar" ? mm.courses > 0 : s.key === "roster" ? mm.shifts > 0 : s.key === "confirmed" ? mm.confirmedDays > 0 : s.key === "paying" ? Boolean(o.subscriptionStatus && o.subscriptionStatus !== "trialing") : false
                  ));
                  return (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-medium text-navy">{o.name}<span className="block text-xs font-normal text-slate-400">{o.slug}</span></td>
                      <td className="py-1.5 pr-3 text-slate-600">{fmt(o.createdAt)}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{owners.get(o.id)?.email ?? "–"}{owners.get(o.id)?.emailVerified ? "" : <span className="ml-1 rounded-full bg-amber/15 px-1.5 text-[10px] font-semibold uppercase text-amber">unconfirmed</span>}</td>
                      {ONBOARDING_EMAIL_STEPS.map((s) => { const r = rows.find((x) => x.step === s); return <td key={s} className="py-1.5 pr-3 text-xs">{r ? <span className={r.status === "sent" ? "font-semibold text-starboard" : "text-slate-400"} title={r.createdAt.toISOString()}>{r.status === "sent" ? `Sent ${fmt(r.createdAt)}` : "Skipped"}</span> : <span className="text-slate-300">–</span>}</td>; })}
                      <td className="py-1.5 text-xs text-slate-600">{reached?.label ?? "Created"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-navy">Leads <span className="text-base font-normal text-slate-400">{periodLeads.length} in the period</span></h2>
        <p className="mb-3 text-sm text-slate-500">Every email typed into a box on the site: a start box, the pricing page, a landing page, or the demo tour&apos;s gate. &ldquo;Became a centre&rdquo; means the same email now owns one. Add a lead to Prospects to run the follow-up from Growth → Prospects; the lawful basis is recorded as their own request.</p>
        {periodLeads.length === 0 ? <p className="text-sm text-slate-400">No leads in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1 pr-3">Email</th><th className="py-1 pr-3">Centre name</th><th className="py-1 pr-3">Where</th><th className="py-1 pr-3">When</th><th className="py-1 pr-3">Became a centre</th><th className="py-1">Prospects</th></tr></thead>
              <tbody>
                {periodLeads.slice(0, 200).map((l) => {
                  const converted = ownerEmails.has(l.email.toLowerCase());
                  const listed = prospects.has(l.email.toLowerCase());
                  return (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-medium text-navy">{l.email}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{l.centreName ?? "–"}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-500">{l.source}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{fmt(l.createdAt)}</td>
                      <td className="py-1.5 pr-3 text-xs">{converted ? <span className="font-semibold text-starboard">Yes</span> : <span className="text-slate-400">Not yet</span>}</td>
                      <td className="py-1.5 text-xs">
                        {listed ? <span className="text-slate-400">On the list</span> : converted ? <span className="text-slate-300">–</span> : (
                          <form action={addLeadToProspectsAction}><input type="hidden" name="leadId" value={l.id} /><button type="submit" className="rounded-lg border border-slate-300 px-2 py-1 font-semibold text-navy hover:bg-slate-50">Add to prospects</button></form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
