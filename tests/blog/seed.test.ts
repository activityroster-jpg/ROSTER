import { describe, it, expect } from "vitest";
import { SEED_ARTICLES, buildSeedRows } from "@/lib/blog/seed";
import { queryForArticle, queryFingerprint } from "@/lib/blog/stock";

describe("blog seed corpus", () => {
  it("has 100 articles with unique slugs", () => {
    expect(SEED_ARTICLES.length).toBe(100);
    const slugs = SEED_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(100);
  });

  it("every article has a title, excerpt and a substantial body (at least 800 words)", () => {
    for (const a of SEED_ARTICLES) {
      expect(a.title.length).toBeGreaterThan(5);
      expect(a.excerpt.length).toBeGreaterThan(10);
      const words = a.body.split(/\s+/).filter(Boolean).length;
      expect(words, `${a.slug} has ${words} words`).toBeGreaterThanOrEqual(800);
    }
  });

  it("every article says what its cover photo should show, and the image search uses it", () => {
    for (const a of SEED_ARTICLES) {
      expect(a.imageQuery.trim().length, a.slug).toBeGreaterThan(3);
      expect(queryForArticle({ slug: a.slug, title: a.title, category: a.category, tags: a.tags.join(",") })).toBe(a.imageQuery);
    }
    // A hand-written post (unknown slug) still gets an on-topic marine query.
    const q = queryForArticle({ slug: "my-own-post", title: "Hello", category: "Instructors & staff", tags: "first aid" });
    expect(q).toMatch(/sail|dinghy/i);
    // The fingerprint is stable and short enough to live in an R2 key.
    expect(queryFingerprint("Sailing Dinghy ")).toBe(queryFingerprint("sailing dinghy"));
    expect(queryFingerprint("sailing dinghy")).toMatch(/^[0-9a-z]{6}$/);
  });
});

describe("buildSeedRows scheduling", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  const rows = buildSeedRows({ liveNow: 10, perDay: 2, now });

  it("makes the first 10 live immediately (publishAt in the past)", () => {
    const live = rows.filter((r) => r.publishAt && (r.publishAt as Date).getTime() <= now.getTime());
    expect(live.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect((rows[i]!.publishAt as Date).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it("schedules the rest two per day into the future", () => {
    const future = rows.slice(10);
    // The 11th and 12th (indexes 10,11) both fall on day +1.
    const day1 = future.slice(0, 2).map((r) => (r.publishAt as Date));
    const sameDay = day1[0]!.toISOString().slice(0, 10) === day1[1]!.toISOString().slice(0, 10);
    expect(sameDay).toBe(true);
    // All future rows are after now.
    for (const r of future) expect((r.publishAt as Date).getTime()).toBeGreaterThan(now.getTime());
  });

  it("marks every seed row published with SEO fields", () => {
    for (const r of rows) {
      expect(r.status).toBe("published");
      expect(r.seoTitle).toContain("ActivityRoster");
      expect(r.body).toContain("check the latest official RYA guidance");
    }
  });
});
