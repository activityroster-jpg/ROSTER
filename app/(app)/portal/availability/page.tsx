import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getAvailabilityRange } from "@/lib/services/availability";
import { addDays, weekStart } from "@/lib/services/schedule";
import { AvailabilityWeeks } from "@/components/portal/AvailabilityWeeks";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

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

  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const weeksAhead = Math.max(1, Math.min(26, settings?.availabilityWeeksAhead ?? 4));
  const monday = weekStart(new Date());
  const horizonEnd = addDays(monday, weeksAhead * 7);
  const initial = await getAvailabilityRange(repos, ctx, me.id, monday, horizonEnd);

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My availability</h1>
      <p className="mb-4 text-sm text-slate-500">Set when you can work — swipe through the weeks and tap each slot.</p>
      <Card>
        <AvailabilityWeeks weeksAhead={weeksAhead} initial={initial} />
      </Card>
    </div>
  );
}
