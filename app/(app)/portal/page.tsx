import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, weekStart } from "@/lib/services/schedule";
import { instructor as instructorTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { todayIso } from "@/lib/domain";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

// Session times are wall-clock values stored as UTC — show them as stored.
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

/**
 * My schedule: every session I'm rostered on from today to the end of the
 * centre's availability horizon, grouped by day, this week first.
 */
export default async function PortalSchedulePage() {
  const { ctx, repos } = await requireTenant();

  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Your instructor profile isn&apos;t linked yet. Ask your centre admin to connect your account.
        </p>
      </Card>
    );
  }

  const today = todayIso();
  const monday = weekStart(new Date(`${today}T00:00:00Z`));
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const weeksAhead = Math.max(1, Math.min(26, settings?.availabilityWeeksAhead ?? 4));
  const horizonEnd = addDays(monday, weeksAhead * 7);

  const [events, myStaff] = await Promise.all([
    getSessionEvents(repos, ctx, today, horizonEnd),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, me.id)),
  ]);
  const myCourseIds = new Set(myStaff.map((s) => s.courseId));
  const mine = events.filter((e) => myCourseIds.has(e.courseId)).sort((a, b) => a.startAt - b.startAt);

  const byDay = new Map<string, typeof mine>();
  for (const s of mine) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const nextMonday = addDays(monday, 7);
  const thisWeek = mine.filter((s) => s.date < nextMonday).length;

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My schedule</h1>
      <p className="mb-4 text-sm text-slate-500">
        {thisWeek === 0 ? "Nothing this week." : `${thisWeek} session${thisWeek === 1 ? "" : "s"} this week.`} Showing the next {weeksAhead} weeks.
      </p>
      <div className="space-y-4">
        {mine.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">No sessions assigned yet. Your centre will roster you once the schedule is set — set your availability so they know when you&apos;re free.</p>
          </Card>
        ) : (
          [...byDay.entries()].map(([date, sessions]) => (
            <div key={date}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {date === today ? "Today · " : date === addDays(today, 1) ? "Tomorrow · " : ""}{fmtDay(date)}
              </p>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <Card key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-navy">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{s.courseName}</p>
                    </div>
                    <StatusPill tone="neutral">{SLOT_LABEL[s.slot] ?? s.slot}</StatusPill>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
