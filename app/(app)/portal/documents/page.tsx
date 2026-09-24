import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { getStaffProfile, type DocumentRow } from "@/lib/services/hr";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

function docStatus(d: DocumentRow): { tone: "covered" | "attention" | "conflict"; label: string } {
  if (!d.expiryDate) return { tone: "covered", label: "Current" };
  const expiry = Date.parse(`${d.expiryDate}T23:59:59.999Z`);
  const now = Date.now();
  if (expiry < now) return { tone: "conflict", label: "Expired" };
  if (expiry < now + 42 * 24 * 60 * 60 * 1000) return { tone: "attention", label: "Expiring" };
  return { tone: "covered", label: "Valid" };
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

  const profile = await getStaffProfile(repos, ctx, me.id);
  const documents = profile?.documents ?? [];

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-semibold text-navy">My documents</h1>
      <p className="mb-4 text-sm text-slate-500">Your tickets, certificates and vetting — with expiry status.</p>

      {documents.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No documents on file yet.</p></Card>
      ) : (
        <ul className="space-y-2">
          {documents.map((d, i) => {
            const st = docStatus(d);
            return (
              <li key={i} className="flex items-center justify-between rounded-card border border-slate-200 bg-white px-3 py-3">
                <span>
                  <span className="block text-sm font-medium text-navy">{d.name}</span>
                  <span className="text-xs text-slate-400">{d.expiryDate ? `Expires ${d.expiryDate}` : "No expiry"}{d.mandatory ? " · mandatory" : ""}</span>
                </span>
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
