import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getStaffProfile } from "@/lib/services/hr";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
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

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My licences &amp; documents</h1>
      <p className="mb-4 text-sm text-slate-500">Upload a photo or PDF of each licence, pick which one it is, and add its expiry date. Your centre checks and confirms them.</p>
      <Card>
        <DocumentManager items={items} admin={false} />
      </Card>
    </div>
  );
}
