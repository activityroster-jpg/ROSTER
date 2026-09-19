import { requireTenant } from "@/lib/tenant/require";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireTenant({ role: "admin" });
  return (
    <Placeholder title="Finance" phase="Phase 5">
      Hours (scheduled vs actual) and pay, with CSV export. Rates come from the pay-rate config.
    </Placeholder>
  );
}
