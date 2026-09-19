import { requireTenant } from "@/lib/tenant/require";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";

export default async function PortalAvailabilityPage() {
  await requireTenant();
  return (
    <Placeholder title="My availability" phase="Phase 5">
      Per day, AM/PM/EV as three buttons — tap to cycle available / tentative / unavailable.
    </Placeholder>
  );
}
