import { requireTenant } from "@/lib/tenant/require";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { LeaveRequests } from "@/components/office/LeaveRequests";
import { OpenShiftsAdmin } from "@/components/office/OpenShiftsAdmin";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const today = new Date().toISOString().slice(0, 10);

  const [leave, shifts, sessions, courses, roles] = await Promise.all([
    listLeave(repos, ctx),
    listOpenShifts(repos, ctx),
    repos.tenant.courseSession.list(ctx),
    repos.tenant.course.list(ctx),
    repos.tenant.roleType.list(ctx),
  ]);

  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Session"]));
  const sessionOptions = sessions
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot))
    .slice(0, 40)
    .map((s) => ({ id: s.id, label: `${courseName.get(s.courseId) ?? "Session"} · ${s.date} ${s.slot}` }));
  const roleOptions = roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Leave &amp; cover</h1>
      <p className="mb-6 text-sm text-slate-500">Approve leave and fill the gaps it leaves with open shifts staff can claim.</p>

      <h2 className="mb-2 font-semibold text-navy">Leave requests</h2>
      <Card className="mb-8 p-0">
        <LeaveRequests rows={leave} />
      </Card>

      <h2 className="mb-2 font-semibold text-navy">Open shifts — cover needed</h2>
      <Card className="p-0">
        <OpenShiftsAdmin shifts={shifts} sessions={sessionOptions} roles={roleOptions} />
      </Card>
    </div>
  );
}
