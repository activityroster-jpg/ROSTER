import { requireTenant } from "@/lib/tenant/require";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";

export default async function PortalHoursPage() {
  await requireTenant();
  return (
    <Placeholder title="My hours" phase="Phase 5">
      Your shifts, rate and month estimate, built from hours records.
    </Placeholder>
  );
}
