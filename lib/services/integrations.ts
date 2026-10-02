import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext, SystemTenantContext } from "@/lib/tenant/context";
import { COURSE_AUDIENCES, type CourseAudience } from "@/lib/db/schema";
import { draftsFromIcs, timeToSlot, toEpochMs, type DraftRow } from "@/lib/import/parse";
import { fetchBookwhenDrafts } from "@/lib/integrations/adapters/bookwhen";
import { assertSafeFeedUrl } from "@/lib/integrations/url-guard";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { writeAudit } from "./audit";
import { suggestCourseType } from "@/lib/domain";
import { createCourseTypeResolver } from "./course-type-resolve";

const FEED_TIMEOUT_MS = 12000;
const FEED_MAX_BYTES = 8 * 1024 * 1024; // 8MB cap

export interface SyncOutcome {
  created: number;
  duplicates: number;
  skipped: number;
  total: number;
}

/** Parse an ICS feed and import it (see importDrafts). */
export async function syncIcsFeed(repos: Repositories, ctx: AnyTenantContext, feedText: string): Promise<SyncOutcome> {
  return importDrafts(repos, ctx, draftsFromIcs(feedText));
}

/**
 * Turn draft course events (from an ICS feed or an API adapter) into courses +
 * sessions, one-way and idempotent: an event that already maps to a course of
 * the same name on the same date + slot is skipped, so re-syncing never
 * duplicates. Only events from today onward are considered. Tenant scoped and
 * audited.
 */
/** Canonical key for a course event: name|date|slot (lowercased name). */
export function eventKey(name: string, date: string, slot: string): string {
  return `${name.trim().toLowerCase()}|${date}|${slot}`;
}

export async function importDrafts(
  repos: Repositories,
  ctx: AnyTenantContext,
  drafts: DraftRow[],
  opts?: { source?: string; onlyKeys?: Set<string>; typeChoices?: Record<string, string> },
): Promise<SyncOutcome> {
  const t = repos.tenant;
  const today = new Date().toISOString().slice(0, 10);

  const [types, courses, sessions] = await Promise.all([
    t.courseType.list(ctx),
    t.course.list(ctx),
    t.courseSession.list(ctx),
  ]);
  const resolver = await createCourseTypeResolver(repos, ctx);
  const courseName = new Map(courses.map((c) => {
    const type = types.find((x) => x.id === c.courseTypeId);
    return [c.id, (c.name ?? type?.name ?? "").trim().toLowerCase()];
  }));
  // Existing "name|date|slot" keys so we don't re-create the same session.
  const existing = new Set<string>();
  for (const s of sessions) {
    const nm = courseName.get(s.courseId) ?? "";
    existing.add(`${nm}|${s.date}|${s.slot}`);
  }

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  let created = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const d of drafts) {
    const name = (d.name ?? "").trim();
    const date = (d.date ?? "").trim();
    if (!name || !ISO.test(date)) { skipped++; continue; }
    if (date < today) { skipped++; continue; } // ignore past events
    const startTime = d.startTime || "09:00";
    const endTime = d.endTime || "";
    const slot = timeToSlot(startTime);
    const key = eventKey(name, date, slot);
    if (opts?.onlyKeys && !opts.onlyKeys.has(key)) { skipped++; continue; }
    if (existing.has(key)) { duplicates++; continue; }

    const audience: CourseAudience = (COURSE_AUDIENCES as readonly string[]).includes(d.audience)
      ? (d.audience as CourseAudience)
      : "all";

    // The admin's review choice wins; unattended syncs match to the regular
    // list, and anything unmatched becomes a one-off type (kept off the list).
    const type = await resolver.resolve(name, audience, opts?.typeChoices?.[key]);

    const course = await t.course.insert(ctx, {
      courseTypeId: type.id,
      name,
      capacity: type.defaultCapacity ?? 8,
      ratio: type.studentsPerInstructor ?? 4,
      status: "scheduled",
      source: opts?.source ?? null,
      externalRef: opts?.source ? key : null,
    });
    await t.courseSession.insert(ctx, {
      courseId: course.id,
      date,
      slot,
      startAt: new Date(toEpochMs(date, startTime, 9)),
      endAt: new Date(toEpochMs(date, endTime || startTime, 12)),
    });
    existing.add(key);
    created++;
  }

  await writeAudit(repos, ctx, {
    action: "integration_sync",
    entity: "integration",
    after: { created, duplicates, skipped, total: drafts.length },
  });

  return { created, duplicates, skipped, total: drafts.length };
}

export interface FeedDiff {
  toAdd: { key: string; name: string; date: string; slot: string; startTime: string; endTime: string; audience: string; suggestedTypeId: string | null }[];
  toRemove: { courseId: string; name: string; date: string; slot: string }[];
  unchanged: number;
}

/**
 * Compare a feed's future events with what's on the platform, WITHOUT changing
 * anything. Returns new events to add, and courses previously imported from this
 * source that are no longer in the feed (candidates to remove — never deleted
 * automatically). Manually-created courses are never proposed for removal.
 */
export async function diffFeed(
  repos: Repositories,
  ctx: AnyTenantContext,
  drafts: DraftRow[],
  source: string,
): Promise<FeedDiff> {
  const t = repos.tenant;
  const today = new Date().toISOString().slice(0, 10);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const [types, courses, sessions] = await Promise.all([t.courseType.list(ctx), t.course.list(ctx), t.courseSession.list(ctx)]);
  const typeById = new Map(types.map((c) => [c.id, c]));
  const nameOf = (c: (typeof courses)[number]) => (c.name ?? typeById.get(c.courseTypeId)?.name ?? "").trim().toLowerCase();
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const firstSession = new Map<string, (typeof sessions)[number]>();
  const allKeys = new Set<string>();
  for (const s of sessions) {
    const c = courseById.get(s.courseId);
    if (c) allKeys.add(eventKey(nameOf(c), s.date, s.slot));
    if (!firstSession.has(s.courseId)) firstSession.set(s.courseId, s);
  }

  const regular = types.filter((c) => c.active && c.listed);
  const feedKeys = new Set<string>();
  const toAdd: FeedDiff["toAdd"] = [];
  for (const d of drafts) {
    const name = (d.name ?? "").trim();
    const date = (d.date ?? "").trim();
    if (!name || !ISO.test(date) || date < today) continue;
    const startTime = d.startTime || "09:00";
    const slot = timeToSlot(startTime);
    const key = eventKey(name, date, slot);
    feedKeys.add(key);
    if (!allKeys.has(key)) {
      const audience = (COURSE_AUDIENCES as readonly string[]).includes(d.audience) ? d.audience : "all";
      toAdd.push({ key, name, date, slot, startTime, endTime: d.endTime || "", audience, suggestedTypeId: suggestCourseType(name, regular)?.type.id ?? null });
    }
  }

  const toRemove: FeedDiff["toRemove"] = [];
  for (const c of courses) {
    if (c.source !== source) continue;
    const s = firstSession.get(c.id);
    if (!s || s.date < today) continue;
    const key = c.externalRef ?? eventKey(nameOf(c), s.date, s.slot);
    if (!feedKeys.has(key)) toRemove.push({ courseId: c.id, name: c.name ?? nameOf(c), date: s.date, slot: s.slot });
  }

  return { toAdd, toRemove, unchanged: Math.max(0, feedKeys.size - toAdd.length) };
}

/** Apply the admin's chosen changes: add selected new events, remove selected courses. Never touches anything not chosen. */
export async function applyChanges(
  repos: Repositories,
  ctx: AnyTenantContext,
  drafts: DraftRow[],
  source: string,
  addKeys: string[],
  removeCourseIds: string[],
  typeChoices?: Record<string, string>,
): Promise<{ added: number; removed: number }> {
  let added = 0;
  if (addKeys.length) {
    const out = await importDrafts(repos, ctx, drafts, { source, onlyKeys: new Set(addKeys), typeChoices });
    added = out.created;
  }
  let removed = 0;
  if (removeCourseIds.length) {
    const courses = await repos.tenant.course.list(ctx);
    const byId = new Map(courses.map((c) => [c.id, c]));
    for (const id of removeCourseIds) {
      const c = byId.get(id);
      if (c && c.source === source) { await repos.tenant.course.delete(ctx, id); removed++; }
    }
  }
  await writeAudit(repos, ctx, { action: "integration_apply_changes", entity: "integration", after: { source, added, removed } });
  return { added, removed };
}

/** Fetch the drafts for one integration row, from its ICS feed or API adapter. */
export async function fetchIntegrationDrafts(row: { kind: string; provider: string; feedUrl: string | null; token: string | null }): Promise<DraftRow[]> {
  if (row.kind === "api") {
    if (row.provider === "bookwhen") {
      if (!row.token) throw new Error("No API key set");
      return fetchBookwhenDrafts(row.token);
    }
    throw new Error(`No API adapter for ${row.provider}`);
  }
  // Default: ICS feed — guard against SSRF, cap time + size.
  if (!row.feedUrl) throw new Error("No calendar feed URL set");
  let safeUrl = assertSafeFeedUrl(row.feedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  let text: string;
  try {
    // Follow redirects by hand so every hop is re-checked by the SSRF guard —
    // a public URL must not be allowed to bounce us onto an internal address.
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const r: Response = await fetch(safeUrl, { headers: { Accept: "text/calendar, text/plain, */*" }, redirect: "manual", signal: controller.signal });
      const location = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && location) {
        safeUrl = assertSafeFeedUrl(new URL(location, safeUrl).toString());
        continue;
      }
      res = r;
      break;
    }
    if (!res) throw new Error("Calendar feed redirected too many times");
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > FEED_MAX_BYTES) throw new Error("Calendar feed is too large");
    text = new TextDecoder().decode(buf);
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("The calendar feed took too long to respond");
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That URL didn't return a calendar (ICS) feed");
  return draftsFromIcs(text);
}

export interface CronSyncSummary {
  ran: number;
  ok: number;
  failed: number;
  created: number;
  details: { org: string; provider: string; result: string }[];
}

/**
 * The scheduled job: sync every auto-sync integration across all centres.
 * Runs per-org with a system context (attributed to the cron in the audit log).
 * Errors on one integration never stop the others.
 */
export async function syncAllIntegrations(repos: Repositories): Promise<CronSyncSummary> {
  const platform = new PlatformRepository(repos.db);
  const rows = await platform.listAutoSyncIntegrations();
  const summary: CronSyncSummary = { ran: 0, ok: 0, failed: 0, created: 0, details: [] };

  for (const row of rows) {
    summary.ran++;
    const ctx: SystemTenantContext = { organisationId: row.organisationId, slug: row.slug, system: true, reason: "cron-sync-integrations" };
    try {
      const drafts = await fetchIntegrationDrafts(row);
      const out = await importDrafts(repos, ctx, drafts, { source: `integration:${row.provider}` });
      const result = `${out.created} added · ${out.duplicates} dup · ${out.skipped} skipped`;
      await repos.tenant.integration.update(ctx, row.id, { status: "connected", lastSyncedAt: new Date(), lastResult: result });
      summary.ok++;
      summary.created += out.created;
      summary.details.push({ org: row.slug, provider: row.provider, result });
    } catch (err) {
      const msg = (err as Error).message || "sync failed";
      await repos.tenant.integration.update(ctx, row.id, { status: "error", lastResult: msg });
      summary.failed++;
      summary.details.push({ org: row.slug, provider: row.provider, result: `ERROR: ${msg}` });
    }
  }
  return summary;
}
