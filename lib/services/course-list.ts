import { and, gte, lt } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { course as courseTable, courseSession as courseSessionTable } from "@/lib/db/schema";

/**
 * Which courses the Courses page shows, without reading every session ever
 * (audit follow-up: bounded reads). Upcoming = any session today or later,
 * plus courses with no sessions yet. Past = courses whose sessions all ended
 * before today, limited to the last `pastMonths` (null for all). The counts
 * for both tabs come from a distinct list of course ids, not from rows.
 */
export interface CourseScope {
  ids: string[];
  upcomingCount: number;
  pastCount: number;
  /** True when the past view is cut to recent months and older courses exist. */
  olderHidden: boolean;
}

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function coursePageScope(
  repos: Repositories,
  ctx: AnyTenantContext,
  opts: { view: "upcoming" | "past"; today: string; pastMonths?: number | null },
): Promise<CourseScope> {
  const t = repos.tenant;
  const [allIds, withSessions, futureIds] = await Promise.all([
    t.course.distinct(ctx, courseTable.id),
    t.courseSession.distinct(ctx, courseSessionTable.courseId),
    t.courseSession.distinct(ctx, courseSessionTable.courseId, gte(courseSessionTable.date, opts.today)),
  ]);
  const has = new Set(withSessions as string[]);
  const future = new Set(futureIds as string[]);
  const undated = (allIds as string[]).filter((id) => !has.has(id));
  const pastAll = [...has].filter((id) => !future.has(id));
  if (opts.view === "upcoming") {
    return { ids: [...future, ...undated], upcomingCount: future.size + undated.length, pastCount: pastAll.length, olderHidden: false };
  }
  const months = opts.pastMonths === undefined ? 12 : opts.pastMonths;
  if (months === null) return { ids: pastAll, upcomingCount: future.size + undated.length, pastCount: pastAll.length, olderHidden: false };
  const since = addDaysIso(opts.today, -Math.round(months * 30.5));
  const recent = new Set((await t.courseSession.distinct(ctx, courseSessionTable.courseId, and(gte(courseSessionTable.date, since), lt(courseSessionTable.date, opts.today)))) as string[]);
  const ids = pastAll.filter((id) => recent.has(id));
  return { ids, upcomingCount: future.size + undated.length, pastCount: pastAll.length, olderHidden: ids.length < pastAll.length };
}
