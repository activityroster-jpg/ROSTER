import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, weekStart } from "@/lib/services/schedule";
import { confirmedDays } from "@/lib/services/roster-days";
import { instructor as instructorTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { todayIso } from "@/lib/domain";
import { Card, StatusPill } from "@/components/ui";
import { ConfirmAssignment } from "@/components/portal/ConfirmAssignment";
import { problemsForInstructor } from "@/lib/services/problems";
import { loadOverrides } from "@/lib/services/session-staff";
import { effectiveStaffBySession } from "@/lib/domain/session-staff";
import Link from "next/link";
import { OfflineWeek, type OfflineSession } from "@/components/portal/OfflineWeek";
import { isOfficeRole } from "@/lib/auth/rbac";
import { apexDomain } from "@/lib/config";

export const dynamic = "force-dynamic";

// Session times are wall-clock values stored as UTC — show them as stored.
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };
const joinNames = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * My schedule: every session I'm rostered on, from today to the end of the
 * centre's availability horizon, grouped by day. A day shows as pending until
 * the office confirms it. When the centre asks staff to accept shifts, each
 * course is accepted once, on its first confirmed card.
 */
export default async function PortalSchedulePage() {
  const { ctx, repos, organisation } = await requireTenant();

  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  if (!me) {
    // The owner or an office admin opened the app: it shows the instructors' side,
    // and they aren't on the staff list (yet). Say so, and where the office is.
    if (isOfficeRole(ctx.role)) {
      const office = `${organisation.slug}.${apexDomain()}/office`;
      return (
        <Card>
          <p className="font-semibold text-navy">You run {organisation.name}; this app is the instructors&apos; side.</p>
          <p className="mt-1 text-sm text-slate-600">The office (roster, staff, courses) is on the web at <a href={`https://${office}`} target="_blank" rel="noopener noreferrer" className="font-medium text-teal underline">{office}</a>. To see your own shifts here, add yourself as an instructor under Office → Staff with this email.</p>
        </Card>
      );
    }
    return (
      <Card>
        <p className="text-sm text-slate-600">
          Your instructor profile isn&apos;t linked yet. Ask whoever runs {organisation.name} to add <span className="font-medium text-navy">this email</span> to their Instructors list; then sign out and back in.
        </p>
      </Card>
    );
  }

  const today = todayIso();
  const monday = weekStart(new Date(`${today}T00:00:00Z`));
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const weeksAhead = Math.max(1, Math.min(26, settings?.availabilityWeeksAhead ?? 4));
  const horizonEnd = addDays(monday, weeksAhead * 7);

  const [events, myStaff, allStaff, instructors, courses, confirmed, courseLocations, locations, myProblemsAll] = await Promise.all([
    getSessionEvents(repos, ctx, today, horizonEnd),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, me.id)),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.course.list(ctx),
    confirmedDays(repos, ctx),
    repos.tenant.courseLocation.list(ctx),
    repos.tenant.location.list(ctx),
    problemsForInstructor(repos, ctx, me.id, { from: today, to: horizonEnd }).then((ps) => ps.filter((p) => ["busy", "on-leave", "double-booked", "not-answered"].includes(p.kind))).catch(() => []),
  ]);
  const overrides = await loadOverrides(repos, ctx, events.map((e) => e.id));
  const membersBySession = effectiveStaffBySession(events, allStaff, overrides);
  // Declines stay visible (the card shows "can't make it"); per-day skips do not.
  const onSession = (sessionId: string) => (membersBySession.get(sessionId) ?? []).some((m) => m.instructorId === me.id);
  // The centre chooses whether staff see a shift before its day is confirmed (on by default,
  // marked Pending) or only once it is confirmed. Off: pending days, and their clashes, stay hidden.
  const seePending = settings?.staffSeePending ?? true;
  const myProblems = seePending ? myProblemsAll : myProblemsAll.filter((p) => confirmed.has(p.date));
  // Accept / decline only when the centre asks for it, and only once the office has confirmed the day.
  const askToAccept = Boolean(settings?.staffAcceptShifts);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const placesOf = (courseId: string) => courseLocations.filter((cl) => cl.courseId === courseId).map((cl) => locationName.get(cl.locationId)).filter((n): n is string => Boolean(n));
  const myByCourse = new Map(myStaff.map((s) => [s.courseId, s]));
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const studentsByCourse = new Map(courses.map((c) => [c.id, c.capacity]));
  const colleaguesOf = (sessionId: string) =>
    (membersBySession.get(sessionId) ?? []).filter((m) => m.instructorId !== me.id && m.status !== "declined").map((m) => nameById.get(m.instructorId) ?? "Instructor");

  const mineAll = events.filter((e) => onSession(e.id)).sort((a, b) => a.startAt - b.startAt);
  const mine = seePending ? mineAll : mineAll.filter((e) => confirmed.has(e.date));
  const pending = mine.filter((e) => !confirmed.has(e.date)).length;

  const weekEnd = addDays(today, 7);
  const offline: OfflineSession[] = mine.filter((s) => s.date < weekEnd).map((s) => {
    const row = myByCourse.get(s.courseId);
    return { day: s.date, dayLabel: `${s.date === today ? "Today · " : s.date === addDays(today, 1) ? "Tomorrow · " : ""}${fmtDay(s.date)}`, time: `${fmtTime(s.startAt)}–${fmtTime(s.endAt)}`, course: s.courseName, place: placesOf(s.courseId).join(", ") || null, note: !confirmed.has(s.date) ? "Pending: not confirmed by your centre yet" : !row ? "Cover for this day only" : row.status === "declined" ? "You said you can't make it" : askToAccept && row.status === "assigned" ? "Not accepted yet" : null };
  });
  const byDay = new Map<string, typeof mine>();
  for (const s of mine) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const nextMonday = addDays(monday, 7);
  const thisWeek = mine.filter((s) => s.date < nextMonday).length;
  const toConfirm = askToAccept ? new Set(mine.filter((s) => confirmed.has(s.date) && myByCourse.get(s.courseId)?.status === "assigned").map((s) => s.courseId)).size : 0;
  const seen = new Set<string>();

  return (
    <div>
      <OfflineWeek centre={organisation.name} sessions={offline} />
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My schedule</h1>
      <p className="mb-4 text-sm text-slate-500">
        {thisWeek === 0 ? "Nothing this week." : `${thisWeek} session${thisWeek === 1 ? "" : "s"} this week.`} Showing the next {weeksAhead} weeks.{pending ? ` ${pending} pending: your centre will confirm ${pending === 1 ? "it" : "them"} and you'll get a message.` : ""}
      </p>
      {myProblems.length > 0 ? (
        <div className="mb-4 rounded-card border border-port/40 bg-port/5 px-4 py-3 text-sm text-navy">
          <p className="font-semibold">Please check {myProblems.length === 1 ? "this" : "these"}:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {myProblems.slice(0, 5).map((p, i) => (
              <li key={`${p.kind}-${p.courseId}-${p.date}-${i}`}>
                {p.kind === "double-booked" ? <>You&apos;re on two courses at once on {fmtDay(p.date)} ({p.courseName} and another). Tell your centre.</>
                  : p.kind === "on-leave" ? <>You&apos;re rostered on {p.courseName} on {fmtDay(p.date)} but on approved leave. Tell your centre.</>
                  : p.kind === "busy" ? <>You&apos;re rostered on {p.courseName} on {fmtDay(p.date)} {p.slot} but marked Busy. <Link href="/portal/availability" className="font-medium text-teal hover:underline">Change your availability</Link> or tell your centre.</>
                  : <>You haven&apos;t marked {fmtDay(p.date)} {p.slot} as Free, but you&apos;re rostered on {p.courseName}. <Link href="/portal/availability" className="font-medium text-teal hover:underline">Confirm you&apos;re free</Link>.</>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {toConfirm > 0 ? (
        <div className="mb-4 rounded-card border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-navy">
          <span className="font-semibold">{toConfirm} course{toConfirm === 1 ? "" : "s"} to accept.</span> Tap “I&apos;ll be there” on each so your centre knows you&apos;ve seen it.
        </div>
      ) : null}
      <div className="space-y-4">
        {mine.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              {seePending ? "No sessions on your roster yet." : "No confirmed sessions yet: your shifts appear here once your centre confirms each day."} Set your availability so your centre knows when you&apos;re free.
            </p>
          </Card>
        ) : (
          [...byDay.entries()].map(([date, sessions]) => (
            <div key={date}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {date === today ? "Today · " : date === addDays(today, 1) ? "Tomorrow · " : ""}{fmtDay(date)}
              </p>
              <div className="space-y-2">
                {sessions.map((s) => {
                  const mineRow = myByCourse.get(s.courseId) ?? null;
                  const dayOnly = !mineRow;
                  const dayConfirmed = confirmed.has(s.date);
                  const first = !dayOnly && dayConfirmed && !seen.has(s.courseId);
                  if (dayConfirmed) seen.add(s.courseId);
                  const others = colleaguesOf(s.id);
                  const students = studentsByCourse.get(s.courseId) ?? 0;
                  return (
                    <Card key={s.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-navy">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{s.courseName}{placesOf(s.courseId).length ? <span className="text-slate-400"> · {placesOf(s.courseId).join(", ")}</span> : null}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {others.length ? `With ${joinNames(others)}` : "Just you so far"}
                            {students > 0 ? ` · ${students} student${students === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <StatusPill tone="neutral">{SLOT_LABEL[s.slot] ?? s.slot}</StatusPill>
                      </div>
                      {!dayConfirmed ? (
                        <p className="mt-2 text-xs font-medium text-amber">Pending: your centre hasn&apos;t confirmed this day yet.{dayOnly ? " Cover for this day only." : ""}</p>
                      ) : dayOnly ? (
                        <p className="mt-2 text-xs text-teal">Cover for this day only.</p>
                      ) : !askToAccept ? (
                        <p className={`mt-2 text-xs ${mineRow?.status === "declined" ? "text-port" : "text-starboard"}`}>{mineRow?.status === "declined" ? "You can't make this course" : "✓ Confirmed"}</p>
                      ) : first && mineRow ? (
                        <ConfirmAssignment assignmentId={mineRow.id} status={mineRow.status} declineNote={mineRow.declineNote} />
                      ) : (
                        <p className={`mt-2 text-xs ${mineRow.status === "confirmed" ? "text-starboard" : mineRow.status === "declined" ? "text-port" : "text-slate-400"}`}>
                          {mineRow.status === "confirmed" ? "✓ Confirmed" : mineRow.status === "declined" ? "You can't make this course" : "Confirm this course on its first session above"}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
