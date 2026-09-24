import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { listLeave } from "@/lib/services/leave";
import { listOpenShifts } from "@/lib/services/openshifts";
import { PortalLeave } from "@/components/portal/PortalLeave";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalLeavePage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p>
      </Card>
    );
  }

  const [allLeave, shifts] = await Promise.all([
    listLeave(repos, ctx),
    listOpenShifts(repos, ctx, true),
  ]);
  const myLeave = allLeave.filter((l) => l.instructorId === me.id);

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-semibold text-navy">Leave &amp; cover</h1>
      <PortalLeave myLeave={myLeave} shifts={shifts} />
    </div>
  );
}
