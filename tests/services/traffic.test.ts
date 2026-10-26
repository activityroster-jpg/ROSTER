import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { TrafficRepository, VISIT_GAP_MS } from "@/lib/db/repositories/traffic";
import { visitorKey } from "@/lib/analytics/visitor";
import { pageView, visitorSeen } from "@/lib/db/schema";

/** Visits, channels and the daily report, without storing anything that identifies a visitor. */
describe("traffic sources", () => {
  const view = (path: string, channel: "direct" | "search" | "ai" = "direct", referrerDomain: string | null = null) => ({ path, referrerDomain, utmSource: null, utmMedium: null, utmCampaign: null, device: "desktop" as const, channel });

  it("counts a visit as the first page in 30 minutes, with the channel on that page only", async () => {
    const { db } = createTestDb();
    const t = new TrafficRepository(db);
    const t0 = new Date("2026-10-20T10:00:00Z");
    expect((await t.record(view("/", "search", "google.co.uk"), "k1", t0)).isVisit).toBe(true);
    expect((await t.record(view("/pricing", "direct"), "k1", new Date(t0.getTime() + 10 * 60_000))).isVisit).toBe(false);
    // 29 minutes after the last page: still the same visit (the window slides)
    expect((await t.record(view("/learn"), "k1", new Date(t0.getTime() + 39 * 60_000))).isVisit).toBe(false);
    // More than 30 minutes of quiet: a new visit
    expect((await t.record(view("/", "ai", "chatgpt.com"), "k1", new Date(t0.getTime() + 39 * 60_000 + VISIT_GAP_MS + 1))).isVisit).toBe(true);
    const rows = await db.select().from(pageView);
    expect(rows.filter((r) => r.isVisit).map((r) => r.channel)).toEqual(["search", "ai"]);
    expect(rows.filter((r) => !r.isVisit).every((r) => r.channel === null && r.referrerDomain === null)).toBe(true);
    // Nothing identifying is stored on a page view
    expect(Object.keys(rows[0]!).sort()).toEqual(["channel", "createdAt", "day", "device", "id", "isVisit", "path", "referrerDomain", "utmCampaign", "utmMedium", "utmSource"]);
  });

  it("counts two pages arriving at the same moment as one visit", async () => {
    const { db } = createTestDb();
    const t = new TrafficRepository(db);
    const at = new Date("2026-10-20T10:00:00Z");
    const [a, b] = await Promise.all([t.record(view("/", "search", "google.com"), "same", at), t.record(view("/"), "same", at)]);
    expect([a.isVisit, b.isVisit].filter(Boolean)).toHaveLength(1);
  });

  it("reports visits by day and channel, landing pages, referrers, sign-ups and markers; and purges", async () => {
    const { db } = createTestDb();
    const t = new TrafficRepository(db);
    const now = new Date("2026-10-26T12:00:00Z");
    await t.record(view("/", "search", "google.com"), "a", new Date("2026-10-20T09:00:00Z"));
    await t.record(view("/learn", "ai", "chatgpt.com"), "b", new Date("2026-10-20T09:05:00Z"));
    await t.record(view("/"), "c", new Date("2026-10-22T15:00:00Z"));
    await t.addMarker("2026-10-25", "LinkedIn post");
    const r = await t.report(60, now);
    expect(r.days).toHaveLength(60);
    expect(r.days.at(-1)).toBe("2026-10-26");
    expect(Object.fromEntries(r.visits.get("2026-10-20")!)).toEqual({ search: 1, ai: 1 });
    expect(r.totals.get("direct")).toBe(1);
    expect(r.topLanding[0]).toEqual({ path: "/", visits: 2 });
    expect(r.topReferrers.map((x) => x.domain).sort()).toEqual(["chatgpt.com", "google.com"]);
    expect(r.markers.map((m) => m.label)).toContain("LinkedIn post");
    expect(r.markers.map((m) => m.day)).toEqual(expect.arrayContaining(["2026-10-19", "2026-10-22"])); // the booklet dates from the migration
    const purged = await t.purge(now);
    expect(purged.visitors).toBe(3);
    expect(await db.select().from(visitorSeen)).toEqual([]);
  });

  it("makes a visitor key that changes every day and never contains the IP", async () => {
    const a = await visitorKey("secret", "203.0.113.7", "Mozilla/5.0 Safari", Date.parse("2026-10-20T10:00:00Z"));
    const b = await visitorKey("secret", "203.0.113.7", "Mozilla/5.0 Safari", Date.parse("2026-10-20T22:00:00Z"));
    const c = await visitorKey("secret", "203.0.113.7", "Mozilla/5.0 Safari", Date.parse("2026-10-21T10:00:00Z"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("203");
  });
});
