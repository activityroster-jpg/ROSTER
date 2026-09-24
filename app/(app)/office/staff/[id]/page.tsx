import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { ensureOnboarding, getStaffProfile, type DocumentRow } from "@/lib/services/hr";
import { OnboardingChecklist } from "@/components/office/OnboardingChecklist";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

function docStatus(d: DocumentRow): { tone: "covered" | "attention" | "conflict"; label: string } {
  if (!d.expiryDate) return { tone: "covered", label: "Current" };
  const expiry = Date.parse(`${d.expiryDate}T23:59:59.999Z`);
  const now = Date.now();
  if (expiry < now) return { tone: "conflict", label: "Expired" };
  if (expiry < now + 42 * 24 * 60 * 60 * 1000) return { tone: "attention", label: "Expiring soon" };
  return { tone: "covered", label: "Valid" };
}

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, repos } = await requireTenant({ role: "admin" });

  await ensureOnboarding(repos, ctx, id);
  const profile = await getStaffProfile(repos, ctx, id);

  if (!profile) {
    return (
      <Card>
        <p className="text-sm text-slate-600">That staff member wasn&apos;t found.</p>
        <Link href="/office/staff" className="mt-2 inline-block text-sm font-semibold text-teal hover:underline">← Back to staff</Link>
      </Card>
    );
  }

  const { instructor, fit, documents, onboarding } = profile;

  return (
    <div>
      <Link href="/office/staff" className="text-sm text-slate-400 hover:text-slate-600">← Staff</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">{instructor.name}</h1>
          <p className="text-sm capitalize text-slate-500">{instructor.employmentType} · {instructor.email ?? "no email"}</p>
        </div>
        {fit.fit ? <StatusPill tone="covered">Fit to roster</StatusPill> : <StatusPill tone="conflict">Blocked</StatusPill>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-0">
          <h2 className="px-4 pt-4 font-semibold text-navy">Documents &amp; certificates</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No documents on file.</td></tr>
              ) : (
                documents.map((d, i) => {
                  const st = docStatus(d);
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-navy">{d.name}{d.mandatory ? <span className="ml-1 text-xs text-port">· mandatory</span> : null}</td>
                      <td className="px-4 py-3 text-slate-500">{d.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{d.expiryDate ?? "—"}</td>
                      <td className="px-4 py-3"><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-navy">Onboarding</h2>
          <OnboardingChecklist items={onboarding.map((o) => ({ id: o.id, label: o.label, done: o.done }))} />
        </Card>
      </div>
    </div>
  );
}
