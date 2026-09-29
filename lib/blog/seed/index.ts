import type { NewBlogPost } from "@/lib/db/schema";
import type { SeedArticle } from "./types";
import { RYA_NOTE } from "./types";
import { BATCH_01_SETUP } from "./batch-01-setup";
import { BATCH_02_COMPLIANCE } from "./batch-02-compliance";
import { BATCH_03_INSTRUCTORS } from "./batch-03-instructors";
import { BATCH_04_COURSES } from "./batch-04-courses";
import { BATCH_05_MARKETING } from "./batch-05-marketing";
import { BATCH_06_GROWTH } from "./batch-06-growth";
import { BATCH_07_OPERATIONS } from "./batch-07-operations";
import { BATCH_08_DIGITAL } from "./batch-08-digital";

/** All seed articles, in publishing order. */
export const SEED_ARTICLES: SeedArticle[] = [
  // Interleave categories so the first live posts, and the daily drip, stay varied.
  ...interleave([
    BATCH_01_SETUP,
    BATCH_05_MARKETING,
    BATCH_02_COMPLIANCE,
    BATCH_04_COURSES,
    BATCH_03_INSTRUCTORS,
    BATCH_06_GROWTH,
    BATCH_07_OPERATIONS,
    BATCH_08_DIGITAL,
  ]),
];

/** Round-robin the batches so consecutive posts vary in topic. */
function interleave(batches: SeedArticle[][]): SeedArticle[] {
  const out: SeedArticle[] = [];
  const max = Math.max(...batches.map((b) => b.length));
  for (let i = 0; i < max; i++) {
    for (const b of batches) {
      if (i < b.length) out.push(b[i]!);
    }
  }
  return out;
}

export interface SeedScheduleOptions {
  /** How many posts are already live on seed (staggered into the past). */
  liveNow?: number;
  /** How many posts to publish per day thereafter. */
  perDay?: number;
  /** Reference "now"; defaults to the current time. */
  now?: Date;
}

/** Start-of-day (UTC) for a date. */
function startOfDayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Turn the seed articles into insertable blog_post rows with a publish schedule:
 * the first `liveNow` are published and staggered into the recent past (so they're
 * all live immediately but dated sensibly), and the rest are scheduled `perDay`
 * at a time into the future. Because the public queries filter on publishAt<=now,
 * the future ones "auto-publish" on their day with no cron required.
 */
export function buildSeedRows(opts: SeedScheduleOptions = {}): NewBlogPost[] {
  const liveNow = opts.liveNow ?? 10;
  const perDay = opts.perDay ?? 2;
  const now = opts.now ?? new Date();
  const today = startOfDayUtc(now);
  const DAY = 24 * 60 * 60 * 1000;
  const HOURS = [9, 15]; // morning + afternoon slots for the daily drip

  return SEED_ARTICLES.map((a, i) => {
    let publishAt: Date;
    if (i < liveNow) {
      // Staggered over the days leading up to now, all in the past → live.
      publishAt = new Date(now.getTime() - (liveNow - i) * DAY);
    } else {
      const k = i - liveNow;
      const day = Math.floor(k / perDay) + 1; // tomorrow onward
      const hour = HOURS[k % perDay] ?? 9;
      publishAt = new Date(today + day * DAY + hour * 60 * 60 * 1000);
    }
    return {
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      body: a.body + RYA_NOTE,
      category: a.category,
      tags: a.tags.join(","),
      author: "The ActivityRoster Team",
      coverEmoji: a.coverEmoji,
      seoTitle: `${a.title} | ActivityRoster`,
      seoDescription: a.excerpt,
      status: "published" as const,
      publishAt,
    };
  });
}

export const SEED_COUNT = SEED_ARTICLES.length;
