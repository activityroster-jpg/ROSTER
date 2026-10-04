import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { addDays, getSessionEvents, weekStart } from "@/lib/services/schedule";
import { publishedWeeks, weekOf } from "@/lib/services/roster";
import { instructor as instructorTable, courseStaff as courseStaffTable } from "@/lib/db/schema";
import { todayIso } from "@/lib/domain";
import { Card, StatusPill } from "@/components/ui";
import { ConfirmAssignment } from "@/components/portal/ConfirmAssignment";

export const dynamic = "force-dynamic";

// Session times are wall-clock values stored as UTC — show them as stored.
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };
const joinNames = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * My schedule: every session I'm rostered on in a PUBLISHED week, from today
 * to the end of the centre's availability horizon, grouped by day. Each course
 * is confirmed once (the first card carries the buttons); who else is on it
 * and how many students are shown once the week is published.
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

  const [events, myStaff, allStaff, instructors, courses, published, courseLocations, locations] = await Promise.all([
    getSessionEvents(repos, ctx, today, horizonEnd),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, me.id)),
    repos.tenant.courseStaff.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.course.list(ctx),
    publishedWeeks(repos, ctx),
    repos.tenant.courseLocation.list(ctx),
    repos.tenant.location.list(ctx),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const placesOf = (courseId: string) => courseLocations.filter((cl) => cl.courseId === courseId).map((cl) => locationName.get(cl.locationId)).filter((n): n is string => Boolean(n));
  const myByCourse = new Map(myStaff.map((s) => [s.courseId, s]));
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const studentsByCourse = new Map(courses.map((c) => [c.id, c.capacity]));
  const teamContacts = instructors
    .filter((i) => i.id !== me.id && i.status === "active" && i.shareContact && !i.anonymisedAt && !i.restrictedAt && (i.phone || i.email))
    .map((i) => ({ id: i.id, name: i.name, phone: i.phone, email: i.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const colleaguesOf = (courseId: string) =>
    allStaff.filter((s) => s.courseId === courseId && s.instructorId !== me.id && s.status !== "declined").map((s) => nameById.get(s.instructorId) ?? "Instructor");

  const mineAll = events.filter((e) => myByCourse.has(e.courseId)).sort((a, b) => a.startAt - b.startAt);
  const mine = mineAll.filter((e) => published.has(weekOf(e.date)));
  const pencilled = mineAll.length - mine.length;

  const byDay = new Map<string, typeof mine>();
  for (const s of mine) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const nextMonday = addDays(monday, 7);
  const thisWeek = mine.filter((s) => s.date < nextMonday).length;
  const toConfirm = new Set(mine.filter((s) => myByCourse.get(s.courseId)?.status === "assigned").map((s) => s.courseId)).size;
  const seen = new Set<string>();

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My schedule</h1>
      <p className="mb-4 text-sm text-slate-500">
        {thisWeek === 0 ? "Nothing this week." : `${thisWeek} session${thisWeek === 1 ? "" : "s"} this week.`} Showing the next {weeksAhead} weeks.
      </p>
      {toConfirm > 0 ? (
        <div className="mb-4 rounded-card border border-amber/50 bg-amber/10 px-4 py-3 text-sm text-navy">
          <span className="font-semibold">{toConfirm} course{toConfirm === 1 ? "" : "s"} to confirm.</span> Tap “I&apos;ll be there” on each so your centre knows you&apos;ve seen it.
        </div>
      ) : null}
      <div className="space-y-4">
        {mine.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              {pencilled > 0
                ? "Your centre has pencilled you in but hasn't published the rota yet — you'll get a notification as soon as it's out."
                : "No sessions on your rota yet. Set your availability so your centre knows when you're free."}
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
                  const mineRow = myByCourse.get(s.courseId)!;
                  const first = !seen.has(s.courseId);
                  seen.add(s.courseId);
                  const others = colleaguesOf(s.courseId);
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
                      {first ? (
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
        {mine.length > 0 && pencilled > 0 ? (
          <p className="text-center text-xs text-slate-400">{pencilled} more session{pencilled === 1 ? "" : "s"} pencilled in for weeks your centre hasn&apos;t published yet.</p>
        ) : null}
      </div>
      {teamContacts.length ? (
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Team contacts</h2>
          <p className="mb-2 text-xs text-slate-500">Colleagues who chose to share their details for cover and swaps. Share yours under Settings.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {teamContacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span className="font-medium text-navy">{c.name}</span>
                <span className="text-slate-600">{c.phone ? <a href={`tel:${c.phone}`} className="hover:text-teal">{c.phone}</a> : null}{c.phone && c.email ? " · " : ""}{c.email ? <a href={`mailto:${c.email}`} className="hover:text-teal">{c.email}</a> : null}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
