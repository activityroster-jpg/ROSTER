import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable, courseStaff as courseStaffTable, courseSession as courseSessionTable } from "@/lib/db/schema";
import { getOpenEntry } from "@/lib/services/timeclock";
import { ClockPanel, type ClockSession } from "@/components/portal/ClockPanel";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const hhmm = (d: Date) => d.toISOString().slice(11, 16);

export default async function PortalTimeClockPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p>
      </Card>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const [open, myStaff, courses] = await Promise.all([
    getOpenEntry(repos, ctx, me.id),
    repos.tenant.courseStaff.list(ctx, eq(courseStaffTable.instructorId, me.id)),
    repos.tenant.course.list(ctx),
  ]);
  const myCourseIds = new Set(myStaff.map((s) => s.courseId));
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Session"]));

  const todaySessions = (await repos.tenant.courseSession.list(ctx, eq(courseSessionTable.date, today)))
    .filter((s) => myCourseIds.has(s.courseId));
  const sessions: ClockSession[] = todaySessions.map((s) => ({
    id: s.id,
    label: courseName.get(s.courseId) ?? "Session",
    time: `${s.slot} · ${hhmm(s.startAt)}–${hhmm(s.endAt)}`,
  }));

  const openLabel = open?.courseSessionId
    ? sessions.find((s) => s.id === open.courseSessionId)?.label ?? null
    : null;

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">Time clock</h1>
      <p className="mb-4 text-sm text-slate-500">{today}</p>
      <ClockPanel openSince={open ? hhmm(open.clockInAt) : null} openLabel={openLabel} sessions={sessions} />
      <p className="mt-4 text-center text-xs text-slate-400">Your hours are logged from clock-in to clock-out and flow straight into payroll.</p>
    </div>
  );
}
