import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

function expiryTone(expiry: string | null): "covered" | "attention" | "conflict" | "neutral" {
  if (!expiry) return "neutral";
  const t = Date.parse(`${expiry}T23:59:59Z`);
  if (t < Date.now()) return "conflict";
  if (t < Date.now() + 30 * 864e5) return "attention";
  return "covered";
}

export default async function PortalDocumentsPage() {
  const { ctx, repos } = await requireTenant();
  const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];

  if (!me) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Your instructor profile isn&apos;t linked yet.</p>
      </Card>
    );
  }

  const [compliance, complianceTypes, quals, gradeTypes] = await Promise.all([
    repos.tenant.complianceItem.list(ctx),
    repos.tenant.complianceType.list(ctx),
    repos.tenant.qualification.list(ctx),
    repos.tenant.qualificationType.list(ctx),
  ]);
  const ctName = new Map(complianceTypes.map((c) => [c.id, c.name]));
  const gtName = new Map(gradeTypes.map((g) => [g.id, g.name]));
  const myCompliance = compliance.filter((c) => c.instructorId === me.id);
  const myQuals = quals.filter((q) => q.instructorId === me.id);

  return (
    <div>
      <h1 className="mb-4 font-display text-xl font-semibold text-navy">My documents</h1>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Compliance checks</h2>
      <div className="mb-6 space-y-2">
        {myCompliance.length === 0 ? (
          <Card><p className="text-sm text-slate-500">No checks recorded.</p></Card>
        ) : (
          myCompliance.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{ctName.get(c.complianceTypeId) ?? "Check"}</p>
                <p className="text-xs text-slate-500">Expires {c.expiryDate ?? "—"}</p>
              </div>
              <StatusPill tone={expiryTone(c.expiryDate ?? null)}>
                {c.expiryDate && expiryTone(c.expiryDate) === "conflict" ? "Expired" : c.verified ? "Verified" : "Pending"}
              </StatusPill>
            </Card>
          ))
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Grades</h2>
      <div className="space-y-2">
        {myQuals.length === 0 ? (
          <Card><p className="text-sm text-slate-500">No grades recorded.</p></Card>
        ) : (
          myQuals.map((q) => (
            <Card key={q.id} className="flex items-center justify-between">
              <p className="font-medium text-navy">{gtName.get(q.qualificationTypeId) ?? "Grade"}</p>
              <StatusPill tone={q.verified ? "covered" : "neutral"}>{q.verified ? "Verified" : "Pending"}</StatusPill>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
