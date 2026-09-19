import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getWeekAvailability } from "@/lib/services/availability";
import { weekStart } from "@/lib/services/schedule";
import { AvailabilityGrid } from "@/components/portal/AvailabilityGrid";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function PortalAvailabilityPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p>
      </Card>
    );
  }

  const monday = weekStart(new Date());
  const initial = await getWeekAvailability(repos, ctx, me.id, monday);
  const days = DAY_LABELS.map((label, i) => {
    const d = new Date(`${monday}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { iso: d.toISOString().slice(0, 10), label };
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My availability</h1>
      <p className="mb-4 text-sm text-slate-500">Week of {monday}</p>
      <Card>
        <AvailabilityGrid days={days} initial={initial} />
      </Card>
    </div>
  );
}
