import { requireTenant } from "@/lib/tenant/require";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  await requireTenant({ role: "admin" });
  return (
    <Placeholder title="Availability" phase="Phase 5">
      An instructors × days grid (AM/PM/EV). Clicking an available slot will surface that slot&apos;s sessions to
      assign the person to.
    </Placeholder>
  );
}
