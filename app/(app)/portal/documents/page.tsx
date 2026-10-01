import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getStaffProfile } from "@/lib/services/hr";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
import { AddLicence } from "@/components/portal/AddLicence";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet. Ask your centre to send you an invite.</p>
      </Card>
    );
  }

  const profile = await getStaffProfile(repos, ctx, me.id);
  const items: DocItem[] = (profile?.documents ?? []).map((d) => ({
    kind: d.kind, itemId: d.itemId, name: d.name, expiryDate: d.expiryDate, mandatory: d.mandatory, hasFile: d.hasFile, docKey: d.docKey, verified: d.verified,
  }));

  // Licences the centre lists that aren't already on my record, for the picker.
  const heldNames = new Set((profile?.documents ?? []).filter((d) => d.kind === "qualification").map((d) => d.name.toLowerCase()));
  const addableTypes = (await repos.tenant.qualificationType.list(ctx))
    .filter((q) => q.active && !heldNames.has(q.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((q) => ({ id: q.id, name: q.name }));

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My licences &amp; documents</h1>
      <p className="mb-4 text-sm text-slate-500">Upload a photo or PDF of each licence, pick which one it is, and add its expiry date. Your centre checks and confirms them.</p>
      <div className="mb-4"><AddLicence types={addableTypes} /></div>
      <Card>
        <DocumentManager items={items} admin={false} />
      </Card>
    </div>
  );
}
