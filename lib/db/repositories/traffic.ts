import { and, asc, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { organisation, pageView, trafficMarker, visitorSeen, type TrafficMarker } from "@/lib/db/schema";
import { isoDateInTz } from "@/lib/domain/time";
import type { Channel } from "@/lib/analytics/channels";

/** A visit lasts while the visitor keeps clicking: 30 minutes since their last page. */
export const VISIT_GAP_MS = 30 * 60 * 1000;
/** Page views are kept 13 months for year-on-year comparison, then deleted. */
export const PAGE_VIEW_RETENTION_DAYS = 400;

export interface PageViewInput {
  path: string;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: "mobile" | "tablet" | "desktop";
  channel: Channel;
}

export interface TrafficReport {
  days: string[];
  /** day → channel → visits */
  visits: Map<string, Map<string, number>>;
  totals: Map<string, number>;
  pageViews: number;
  topReferrers: { domain: string; channel: string; visits: number }[];
  topLanding: { path: string; visits: number }[];
  signups: Map<string, number>;
  markers: TrafficMarker[];
}

/**
 * The traffic-sources tables (control plane, platform owner only): page views
 * on the public site, the 30-minute "seen" list that tells a new visit from
 * the next page, and the chart's date markers.
 */
export class TrafficRepository {
  constructor(private readonly db: Database) {}

  /**
   * Record one page view. `visitorKey` is the day-salted hash: if it was seen
   * in the last 30 minutes this is the next page of the same visit, otherwise
   * a new visit, which carries the channel. The key's expiry slides forward.
   */
  async record(view: PageViewInput, visitorKey: string, now: Date = new Date()): Promise<{ isVisit: boolean }> {
    // Race-safe: each step is one statement, so two pages arriving together can't both count as a new visit.
    const expiresAt = new Date(now.getTime() + VISIT_GAP_MS);
    const fresh = await this.db.insert(visitorSeen).values({ key: visitorKey, expiresAt }).onConflictDoNothing().returning({ key: visitorSeen.key });
    let isVisit = fresh.length > 0;
    if (!isVisit) {
      const lapsed = await this.db.update(visitorSeen).set({ expiresAt }).where(and(eq(visitorSeen.key, visitorKey), lte(visitorSeen.expiresAt, now))).returning({ key: visitorSeen.key });
      isVisit = lapsed.length > 0;
      if (!isVisit) await this.db.update(visitorSeen).set({ expiresAt }).where(eq(visitorSeen.key, visitorKey));
    }
    await this.db.insert(pageView).values({
      day: isoDateInTz(now),
      path: view.path,
      referrerDomain: isVisit ? view.referrerDomain : null,
      utmSource: view.utmSource,
      utmMedium: view.utmMedium,
      utmCampaign: view.utmCampaign,
      device: view.device,
      isVisit,
      channel: isVisit ? view.channel : null,
      createdAt: now,
    });
    return { isVisit };
  }

  /** Hourly: forget expired visitor keys, and page views past the retention window. */
  async purge(now: Date = new Date()): Promise<{ visitors: number; pageViews: number }> {
    const v = await this.db.delete(visitorSeen).where(lt(visitorSeen.expiresAt, now)).returning({ key: visitorSeen.key });
    const cutoff = new Date(now.getTime() - PAGE_VIEW_RETENTION_DAYS * 86_400_000);
    const p = await this.db.delete(pageView).where(lt(pageView.createdAt, cutoff)).returning({ id: pageView.id });
    return { visitors: v.length, pageViews: p.length };
  }

  async listMarkers(): Promise<TrafficMarker[]> {
    return this.db.select().from(trafficMarker).orderBy(asc(trafficMarker.day));
  }

  async addMarker(day: string, label: string): Promise<void> {
    await this.db.insert(trafficMarker).values({ day, label });
  }

  async deleteMarker(id: string): Promise<void> {
    await this.db.delete(trafficMarker).where(eq(trafficMarker.id, id));
  }

  /** Everything the Traffic sources page shows, for the `days` days up to and including `today` (London dates). */
  async report(days: number, now: Date = new Date()): Promise<TrafficReport> {
    const list: string[] = [];
    for (let i = days - 1; i >= 0; i--) list.push(isoDateInTz(now.getTime() - i * 86_400_000));
    const from = list[0]!;
    const inRange = gte(pageView.day, from);
    const [byDay, views, refs, landing, orgs, markers] = await Promise.all([
      this.db.select({ day: pageView.day, channel: pageView.channel, n: sql<number>`count(*)` }).from(pageView).where(and(inRange, eq(pageView.isVisit, true))).groupBy(pageView.day, pageView.channel),
      this.db.select({ n: sql<number>`count(*)` }).from(pageView).where(inRange),
      this.db.select({ domain: pageView.referrerDomain, channel: pageView.channel, n: sql<number>`count(*)` }).from(pageView).where(and(inRange, eq(pageView.isVisit, true), isNotNull(pageView.referrerDomain))).groupBy(pageView.referrerDomain, pageView.channel).orderBy(desc(sql`count(*)`)).limit(15),
      this.db.select({ path: pageView.path, n: sql<number>`count(*)` }).from(pageView).where(and(inRange, eq(pageView.isVisit, true))).groupBy(pageView.path).orderBy(desc(sql`count(*)`)).limit(15),
      this.db.select({ createdAt: organisation.createdAt }).from(organisation).where(gte(organisation.createdAt, new Date(now.getTime() - (days + 1) * 86_400_000))),
      this.listMarkers(),
    ]);
    const visits = new Map<string, Map<string, number>>();
    const totals = new Map<string, number>();
    for (const r of byDay) {
      const ch = r.channel ?? "direct";
      const m = visits.get(r.day) ?? new Map<string, number>();
      m.set(ch, (m.get(ch) ?? 0) + Number(r.n));
      visits.set(r.day, m);
      totals.set(ch, (totals.get(ch) ?? 0) + Number(r.n));
    }
    const signups = new Map<string, number>();
    for (const o of orgs) { const d = isoDateInTz(o.createdAt); if (d >= from) signups.set(d, (signups.get(d) ?? 0) + 1); }
    return {
      days: list,
      visits,
      totals,
      pageViews: Number(views[0]?.n ?? 0),
      topReferrers: refs.map((r) => ({ domain: r.domain ?? "", channel: r.channel ?? "other", visits: Number(r.n) })),
      topLanding: landing.map((r) => ({ path: r.path, visits: Number(r.n) })),
      signups,
      markers: markers.filter((m) => m.day >= from),
    };
  }
}
