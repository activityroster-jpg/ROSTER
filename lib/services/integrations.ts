import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext, SystemTenantContext } from "@/lib/tenant/context";
import { COURSE_AUDIENCES, type CourseAudience } from "@/lib/db/schema";
import { draftsFromIcs, timeToSlot, toEpochMs, type DraftRow } from "@/lib/import/parse";
import { fetchBookwhenDrafts } from "@/lib/integrations/adapters/bookwhen";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { writeAudit } from "./audit";

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
export async function importDrafts(
  repos: Repositories,
  ctx: AnyTenantContext,
  drafts: DraftRow[],
): Promise<SyncOutcome> {
  const t = repos.tenant;
  const today = new Date().toISOString().slice(0, 10);

  const [types, courses, sessions] = await Promise.all([
    t.courseType.list(ctx),
    t.course.list(ctx),
    t.courseSession.list(ctx),
  ]);
  const typeByName = new Map(types.map((c) => [c.name.trim().toLowerCase(), c]));
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
    const key = `${name.toLowerCase()}|${date}|${slot}`;
    if (existing.has(key)) { duplicates++; continue; }

    const audience: CourseAudience = (COURSE_AUDIENCES as readonly string[]).includes(d.audience)
      ? (d.audience as CourseAudience)
      : "all";

    let type = typeByName.get(name.toLowerCase());
    if (!type) {
      type = await t.courseType.insert(ctx, {
        name,
        scheme: "Imported",
        audience,
        defaultCapacity: 8,
        studentsPerInstructor: 4,
        requiresSafetyBoat: audience === "youth",
        active: true,
      });
      typeByName.set(name.toLowerCase(), type);
    }

    const course = await t.course.insert(ctx, {
      courseTypeId: type.id,
      name,
      capacity: type.defaultCapacity ?? 8,
      ratio: type.studentsPerInstructor ?? 4,
      status: "scheduled",
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

const webcalToHttps = (u: string) => (u.trim().startsWith("webcal://") ? "https://" + u.trim().slice("webcal://".length) : u.trim());

/** Fetch the drafts for one integration row, from its ICS feed or API adapter. */
export async function fetchIntegrationDrafts(row: { kind: string; provider: string; feedUrl: string | null; token: string | null }): Promise<DraftRow[]> {
  if (row.kind === "api") {
    if (row.provider === "bookwhen") {
      if (!row.token) throw new Error("No API key set");
      return fetchBookwhenDrafts(row.token);
    }
    throw new Error(`No API adapter for ${row.provider}`);
  }
  // Default: ICS feed
  if (!row.feedUrl) throw new Error("No calendar feed URL set");
  const res = await fetch(webcalToHttps(row.feedUrl), { headers: { Accept: "text/calendar, text/plain, */*" } });
  if (!res.ok) throw new Error(`Feed responded ${res.status}`);
  const text = await res.text();
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
      const out = await importDrafts(repos, ctx, drafts);
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
