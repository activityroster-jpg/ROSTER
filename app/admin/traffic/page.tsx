import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { TrafficRepository, type TrafficReport } from "@/lib/db/repositories/traffic";
import { CHANNELS, CHANNEL_META, type Channel } from "@/lib/analytics/channels";
import { TrafficChart, type ChartDay } from "@/components/admin/TrafficChart";
import { Card } from "@/components/ui";
import { addTrafficMarkerAction, deleteTrafficMarkerAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Traffic sources" };

const DAYS = 60;

/**
 * Where visitors to the public site come from, counted without cookies (the
 * beacon in components/marketing/PageViewBeacon, recorded by /api/v). A visit
 * is a visitor's first page in 30 minutes; signed-in owners and admins and
 * bots are left out.
 */
export default async function TrafficPage() {
  await requirePlatformAdmin();
  let r: TrafficReport | null = null;
  try { r = await new TrafficRepository(await getDb()).report(DAYS); } catch { /* tables arrive with the next migration */ }
  if (!r) return <p className="text-sm text-slate-500">Traffic sources start counting once the latest deploy (migration 0095) is live.</p>;

  const total = CHANNELS.reduce((n, c) => n + (r.totals.get(c) ?? 0), 0);
  const signups = [...r.signups.values()].reduce((a, b) => a + b, 0);
  const days: ChartDay[] = r.days.map((d) => ({ day: d, byChannel: Object.fromEntries(r.visits.get(d) ?? new Map()) as Partial<Record<Channel, number>>, signups: r.signups.get(d) ?? 0 }));
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "–");
  const chip = (ch: string) => CHANNEL_META[(CHANNELS as readonly string[]).includes(ch) ? (ch as Channel) : "other"];

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Traffic sources</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">Where visitors to the public site come from over the last {DAYS} days, counted without cookies or IP addresses. A visit is someone&apos;s first page in 30 minutes. Your own visits while signed in, centre owners and admins, and bots are left out.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Visits</p><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{total}</p></Card>
        <Card><p className="text-sm text-slate-500">Page views</p><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{r.pageViews}</p></Card>
        <Card><p className="text-sm text-slate-500">Trial sign-ups</p><p className="mt-1 text-2xl font-semibold tabular-nums text-navy">{signups}</p></Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold text-navy">Visits per day, by channel</h2>
        {total === 0 ? <p className="mb-2 text-sm text-slate-400">No visits counted yet. The chart fills in as people visit the site.</p> : null}
        <TrafficChart days={days} markers={r.markers.map((m) => ({ day: m.day, label: m.label }))} />
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-2 font-semibold text-navy">By channel</h2>
          <table className="w-full text-sm">
            <tbody>
              {CHANNELS.map((c) => (
                <tr key={c} className="border-t border-slate-100 first:border-0" title={CHANNEL_META[c].hint}>
                  <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_META[c].color }} />{CHANNEL_META[c].label}</span></td>
                  <td className="py-1.5 text-right tabular-nums text-navy">{r.totals.get(c) ?? 0}</td>
                  <td className="w-12 py-1.5 text-right tabular-nums text-slate-500">{pct(r.totals.get(c) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500"><strong className="text-navy">Direct</strong> means no referrer and no tags. It also includes bookmarks, typed addresses, QR codes, and links opened from email apps, WhatsApp and PDFs, because those don&apos;t pass a referrer. Tag links you hand out (for example <code className="rounded bg-slate-100 px-1">?utm_source=booklet&amp;utm_medium=print</code>) to see them separately.</p>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-navy">Top referring sites</h2>
          {r.topReferrers.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
            <table className="w-full text-sm"><tbody>
              {r.topReferrers.map((x) => (
                <tr key={`${x.domain}-${x.channel}`} className="border-t border-slate-100 first:border-0">
                  <td className="py-1.5"><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: chip(x.channel).color }} title={chip(x.channel).label} />{x.domain}</span></td>
                  <td className="py-1.5 text-right tabular-nums text-navy">{x.visits}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold text-navy">Top landing pages</h2>
          {r.topLanding.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
            <table className="w-full text-sm"><tbody>
              {r.topLanding.map((x) => (
                <tr key={x.path} className="border-t border-slate-100 first:border-0">
                  <td className="max-w-0 truncate py-1.5"><a href={x.path} target="_blank" rel="noreferrer" className="text-navy hover:text-teal hover:underline">{x.path}</a></td>
                  <td className="py-1.5 text-right tabular-nums text-navy">{x.visits}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-1 font-semibold text-navy">Chart markers</h2>
        <p className="mb-3 text-xs text-slate-500">Dated notes on the chart: a mailing, a post, an event. They show as dashed lines.</p>
        <form action={addTrafficMarkerAction} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">Date<input type="date" name="day" required className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-slate-500">Label<input name="label" required maxLength={60} placeholder="e.g. LinkedIn post" className="mt-1 block w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
          <button type="submit" className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-700">Add marker</button>
        </form>
        <ul className="divide-y divide-slate-100 text-sm">
          {r.markers.length === 0 ? <li className="py-1.5 text-slate-400">No markers in the last {DAYS} days.</li> : r.markers.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-1.5">
              <span><span className="tabular-nums text-slate-500">{m.day}</span> · {m.label}</span>
              <form action={deleteTrafficMarkerAction}><input type="hidden" name="id" value={m.id} /><button type="submit" className="text-xs text-slate-400 hover:text-port">Remove</button></form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
