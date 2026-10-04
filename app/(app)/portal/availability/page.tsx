import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { availabilityHorizon, loadInstructorAvailability, patternOf } from "@/lib/services/availability";
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
  const horizon = availabilityHorizon(settings);
  const { index, notes } = await loadInstructorAvailability(repos, ctx, me.id);
  const dated: Record<string, "available" | "tentative" | "unavailable"> = {};
  for (const [k, v] of Object.entries(index.dated)) {
    const date = k.slice(0, 10);
    if (date >= horizon.from && date < horizon.to) dated[k] = v;
  }
  const notesInWindow = Object.fromEntries(Object.entries(notes).filter(([d]) => d >= horizon.from && d < horizon.to));

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My availability</h1>
      <p className="mb-4 text-sm text-slate-500">Every slot counts as Busy until you mark it Free or Maybe. Set your usual week once and only change the exceptions.</p>
      <Card>
        <AvailabilityWeeks horizon={horizon} dated={dated} pattern={patternOf(index)} notes={notesInWindow} />
      </Card>
    </div>
  );
}
