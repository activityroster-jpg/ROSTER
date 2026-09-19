import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { getWeekSchedule, weekStart } from "@/lib/services/schedule";
import { instructor as instructorTable } from "@/lib/db/schema";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmt(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function PortalSchedulePage() {
  const { ctx, repos } = await requireTenant();

  // Find the instructor record linked to this user (tenant scoped).
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

  const monday = weekStart(new Date());
  const { sessions } = await getWeekSchedule(repos, ctx, monday);
  const staffAssignments = await repos.tenant.courseStaff.list(ctx);
  const myCourseIds = new Set(staffAssignments.filter((s) => s.instructorId === me.id).map((s) => s.courseId));
  const mine = sessions.filter((s) => myCourseIds.has(s.courseId));

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-semibold text-navy">My schedule</h1>
      <div className="space-y-3">
        {mine.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">No sessions assigned this week.</p>
          </Card>
        ) : (
          mine.map((s) => (
            <Card key={s.sessionId} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{s.courseName}</p>
                <p className="text-xs text-slate-500">{fmt(s.startAt)}</p>
              </div>
              <StatusPill tone="neutral">{s.slot}</StatusPill>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
