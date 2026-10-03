import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { RunAgentButton } from "@/components/admin/OutreachControls";
import { OutreachSuppressions } from "@/components/admin/OutreachSuppressions";
import { londonDayStart, londonMonthStart, londonWeekStart, windowOpen } from "@/lib/outreach/engine";
import { dailyUsage, summariseUsage } from "@/lib/outreach/usage";
import { fmtUsd } from "@/lib/outreach/cost";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach" };

const STATUS_LABEL: Record<string, string> = { draft: "Draft", running: "Running", paused: "Paused", finished: "Finished" };
const STATUS_CLS: Record<string, string> = { draft: "bg-slate-100 text-slate-600", running: "bg-emerald-50 text-emerald-700", paused: "bg-amber-50 text-amber-700", finished: "bg-slate-100 text-slate-500" };

export default async function AdminOutreachPage() {
  await requirePlatformAdmin();
  const env = getEnv();
  const p = new PlatformRepository(await getDb());
  let campaigns: Awaited<ReturnType<PlatformRepository["listOutreachCampaigns"]>> = [];
  let leadCounts = new Map<string, number>();
  let msgCounts = new Map<string, number>();
  let suppressions: Awaited<ReturnType<PlatformRepository["listSuppressions"]>> = [];
  let perCampaign = new Map<string, Map<string, number>>();
  const now = new Date();
  let usageRows: Awaited<ReturnType<PlatformRepository["listAiUsageSince"]>> = [];
  let sentCounts = { day: 0, week: 0, month: 0 };
  try {
    const monthStart = londonMonthStart(now);
    const since = new Date(Math.min(monthStart.getTime(), now.getTime() - 14 * 86_400_000));
    [usageRows, sentCounts.day, sentCounts.week, sentCounts.month] = await Promise.all([
      p.listAiUsageSince(since), p.countOutreachSentBetween(londonDayStart(now), now), p.countOutreachSentBetween(londonWeekStart(now), now), p.countOutreachSentBetween(monthStart, now),
    ]);
  } catch {
    // ai_usage table may not exist until the migration is applied
  }
  const usage = summariseUsage(usageRows, now, sentCounts);
  const daily = dailyUsage(usageRows, now, 14).filter((d) => d.calls > 0);
  try {
    [campaigns, leadCounts, msgCounts, suppressions] = await Promise.all([p.listOutreachCampaigns(), p.outreachLeadCountsByStatus(), p.outreachMessageCountsByStatus(), p.listSuppressions(500)]);
    perCampaign = new Map(await Promise.all(campaigns.map(async (c) => [c.id, await p.outreachLeadCountsByStatus(c.id)] as const)));
  } catch {
    // tables may not exist until the migration is applied
  }
  const n = (m: Map<string, number>, ...keys: string[]) => keys.reduce((a, k) => a + (m.get(k) ?? 0), 0);
  const totalLeads = [...leadCounts.values()].reduce((a, b) => a + b, 0);
  const sent = [...msgCounts.values()].reduce((a, b) => a + b, 0);
  const opened = n(msgCounts, "opened", "clicked");
  const replied = n(leadCounts, "replied", "booked");
  const bounced = n(msgCounts, "bounced");
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
  const setup = [
    { key: "ANTHROPIC_API_KEY", ok: !!env.ANTHROPIC_API_KEY, what: "Claude API key: the agent reads each centre's website and writes a personal note. Without it, templates are sent as written." },
    { key: "RESEND_API_KEY", ok: !!env.RESEND_API_KEY, what: "Resend key: nothing is sent without it. Sends only happen in production." },
    { key: "RESEND_WEBHOOK_SECRET", ok: !!env.RESEND_WEBHOOK_SECRET, what: "Resend webhook secret: delivery, opens, bounces and complaints flow back and bounced addresses are blocked automatically." },
    { key: "OUTREACH_CRON_SECRET", ok: !!env.OUTREACH_CRON_SECRET, what: "Tick secret: lets an external hourly pinger run the agent so you don't have to press Run." },
  ];
  const running = campaigns.filter((c) => c.status === "running");

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-navy">Outreach agent</h1>
        <div className="flex items-center gap-2">
          <RunAgentButton />
          <Link href="/admin/outreach/new" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">+ New campaign</Link>
        </div>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">Pick an audience from your Marketing list, write the pitch once, and the agent does the rest: it reads each centre&rsquo;s website, finds the right person and address, writes a short personal email, follows up on a schedule, and stops the moment they reply or opt out. You see everything before and after it goes.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><p className="text-xs font-semibold text-navy">Centres in campaigns</p><p className="mt-1 text-2xl font-semibold text-navy">{totalLeads}</p><p className="text-xs text-slate-400">{n(leadCounts, "new")} still to research</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Emails sent</p><p className="mt-1 text-2xl font-semibold text-navy">{sent}</p><p className="text-xs text-slate-400">{n(leadCounts, "queued", "in_sequence")} in sequence</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Opened</p><p className="mt-1 text-2xl font-semibold text-navy">{pct(opened, sent)}</p><p className="text-xs text-slate-400">{opened} of {sent}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Replied or booked</p><p className="mt-1 text-2xl font-semibold text-starboard">{replied}</p><p className="text-xs text-slate-400">{pct(replied, totalLeads)} of centres</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Bounced</p><p className={`mt-1 text-2xl font-semibold ${bounced ? "text-port" : "text-navy"}`}>{bounced}</p><p className="text-xs text-slate-400">{n(leadCounts, "opted_out")} opted out</p></Card>
      </div>

      <section className="mb-6 rounded-card border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-navy">Usage &amp; cost</h2>
          <p className="text-xs text-slate-500">Claude API spend at list price, in US dollars (Anthropic bills in USD). Emails via Resend are free up to 3,000 a month. GitHub and Cloudflare cost nothing at this volume.</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label} className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-semibold text-navy">{u.label}</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{fmtUsd(u.costMicros)}</p>
              <p className="mt-1 text-xs text-slate-500">{u.research} centre{u.research === 1 ? "" : "s"} researched · {u.drafts} email{u.drafts === 1 ? "" : "s"} drafted · {u.emailsSent} sent</p>
              <p className="text-[11px] text-slate-400">{(u.inputTokens / 1000).toFixed(1)}k tokens in · {(u.outputTokens / 1000).toFixed(1)}k out</p>
            </div>
          ))}
        </div>
        {daily.length ? (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-teal">Last 14 days, by day</summary>
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left text-slate-400"><th className="py-1 pr-3 font-medium">Day</th><th className="py-1 pr-3 font-medium">Calls</th><th className="py-1 font-medium">Cost</th></tr></thead>
              <tbody>{daily.map((d) => <tr key={d.dayKey} className="border-t border-slate-100"><td className="py-1 pr-3 text-navy">{d.dayKey}</td><td className="py-1 pr-3">{d.calls}</td><td className="py-1">{fmtUsd(d.costMicros)}</td></tr>)}</tbody>
            </table>
          </details>
        ) : <p className="mt-3 text-xs text-slate-400">No Claude calls recorded yet. Spend appears here once a campaign researches or drafts.</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-2 font-semibold text-navy">Campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="rounded-card border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No campaigns yet. <Link href="/admin/outreach/new" className="font-semibold text-teal hover:underline">Create the first one</Link>: it takes two minutes and nothing is sent until you launch it.</div>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((c) => {
                const m = perCampaign.get(c.id) ?? new Map<string, number>();
                const total = [...m.values()].reduce((a, b) => a + b, 0);
                return (
                  <li key={c.id}>
                    <Link href={`/admin/outreach/${c.id}`} className="block rounded-card border border-slate-200 bg-white p-4 hover:border-teal">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                        <span className="font-semibold text-navy">{c.name}</span>
                        {c.status === "running" ? <span className="text-xs text-slate-400">{windowOpen(c) ? "inside sending hours" : "outside sending hours"}</span> : null}
                        <span className="ml-auto text-xs text-slate-500">{total} centres · {n(m, "queued", "in_sequence")} active · {n(m, "replied", "booked")} replied · {n(m, "no_email", "failed")} need you</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">From {c.fromName} &lt;{c.fromEmail}&gt; · up to {c.dailyCap}/day, {c.sendWindowStart}:00–{c.sendWindowEnd}:00{c.weekdaysOnly ? " weekdays" : ""} · {c.aiPersonalise ? "AI-personalised" : "templates as written"}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6"><OutreachSuppressions rows={suppressions.map((s) => ({ email: s.email, reason: s.reason, note: s.note, createdAt: s.createdAt.toISOString() }))} /></div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-navy">Set-up</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {setup.map((s) => <li key={s.key} className="flex gap-2"><span className={s.ok ? "text-starboard" : "text-amber-500"}>{s.ok ? "✓" : "○"}</span><span><span className="font-mono text-xs text-navy">{s.key}</span><br /><span className="text-xs text-slate-500">{s.what}</span></span></li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Resend webhook URL: <span className="font-mono">https://{env.APP_APEX_DOMAIN}/api/webhooks/resend</span> (events: delivered, opened, clicked, bounced, complained).</p>
            <p className="mt-2 text-xs text-slate-500">Hourly tick: have any pinger call <span className="font-mono">POST https://{env.APP_APEX_DOMAIN}/api/outreach/tick</span> with header <span className="font-mono">x-outreach-secret</span>. Each tick researches up to 10 new centres and sends what is due. See <span className="font-mono">docs/outreach.md</span>.</p>
          </section>
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-navy">How it stays polite and legal</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Business-to-business only: it writes to centres and clubs about their roles, never to private individuals.</li>
              <li>Every email names the sender and company, carries the postal address and a one-click opt-out, and sets List-Unsubscribe headers.</li>
              <li>Opt-outs, bounces, complaints and replies stop the sequence and go on the do-not-email list for good.</li>
              <li>Capped per day, sent in UK working hours, and never to a centre contacted in the last 90 days by default.</li>
              <li>The writer may only mention facts it actually read on their site; it is told never to invent names, numbers or claims.</li>
            </ul>
            {running.length === 0 && campaigns.length ? <p className="mt-2 text-xs text-slate-400">No campaign is running right now.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
