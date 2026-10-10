import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { SignOutLink } from "@/components/SignOutLink";

export const dynamic = "force-dynamic";

/**
 * Parent accounts made before the parent view was retired (10 Oct 2026) land
 * here: rosters are no longer shared with parents, so there is nothing to show.
 */
export default async function ParentPage() {
  const { organisation } = await requireTenant({ permission: "parent.view" });
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <h1 className="font-display text-xl font-semibold text-navy">{organisation.name}</h1>
        <p className="mt-2 text-sm text-slate-600">ActivityRoster no longer shows rosters to parents and guardians. For anything about your child&rsquo;s shifts, please contact {organisation.name} directly.</p>
        <div className="mt-4"><SignOutLink /></div>
      </Card>
    </div>
  );
}
