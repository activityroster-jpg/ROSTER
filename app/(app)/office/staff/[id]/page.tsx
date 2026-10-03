import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { ensureOnboarding, getStaffProfile } from "@/lib/services/hr";
import { fitReason } from "@/lib/services/staff";
import { OnboardingChecklist } from "@/components/office/OnboardingChecklist";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";
import { Card, StatusPill } from "@/components/ui";
import { EditInstructorForm } from "@/components/office/EditInstructorForm";
import { PayRateForm } from "@/components/office/PayRateForm";
import { listPayRates } from "@/lib/services/pay-rates";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

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

  const { instructor, fit, documents, approvedCourses, onboarding } = profile;
  const [rates, roles, settings] = await Promise.all([listPayRates(repos, ctx, id), repos.tenant.roleType.list(ctx), repos.tenant.orgSettings.list(ctx)]);
  const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
  const currency = SYMBOL[settings[0]?.currency ?? "GBP"] ?? "£";
  const payOn = hasFeature(settings[0]?.enabledFeatures, "payroll");
  const left = instructor.status === "inactive";
  const membership = instructor.userId ? await repos.control.membershipFor(instructor.userId, ctx.organisationId) : null;
  const inviteStatus = !instructor.userId ? "none" : membership?.status === "active" ? "accepted" : "pending";
  const docItems: DocItem[] = documents.map((d) => ({
    kind: d.kind, itemId: d.itemId, name: d.name, expiryDate: d.expiryDate, mandatory: d.mandatory, hasFile: d.hasFile, docKey: d.docKey, verified: d.verified,
  }));

  return (
    <div>
      <Link href="/office/staff" className="text-sm text-slate-400 hover:text-slate-600">← Staff</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">{instructor.name}{left ? <span className="ml-2 align-middle rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Left</span> : null}</h1>
          <p className="text-sm text-slate-500"><span className="capitalize">{instructor.employmentType}</span> · {instructor.email ?? "no email"}{instructor.phone ? ` · ${instructor.phone}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          {instructor.email && !left ? <InviteInstructorButton instructorId={instructor.id} status={inviteStatus} /> : null}
          {left ? null : fit.fit ? <StatusPill tone="covered">Fit to roster</StatusPill> : <StatusPill tone="conflict">{fitReason(fit) || "Not cleared"}</StatusPill>}
        </div>
      </div>
      <div className="mb-6"><EditInstructorForm instructor={{ id: instructor.id, name: instructor.name, email: instructor.email, phone: instructor.phone, employmentType: instructor.employmentType, status: instructor.status }} /></div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-navy">Licences &amp; documents</h2>
            <DocumentManager items={docItems} admin />
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold text-navy">Courses they can teach</h2>
            {approvedCourses.length === 0 ? (
              <p className="text-sm text-slate-400">None set. Add courses when editing this instructor, or they&apos;re inferred from tickets held.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {approvedCourses.map((c) => <li key={c.id} className="rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">{c.name}</li>)}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {payOn ? (
            <Card>
              <h2 className="mb-1 font-semibold text-navy">Pay</h2>
              <p className="mb-3 text-xs text-slate-500">How this instructor is paid. Payroll uses it for every session they&apos;re rostered on.</p>
              <PayRateForm instructorId={instructor.id} rates={rates} roles={roles.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }))} currency={currency} />
            </Card>
          ) : null}
          <Card>
            <h2 className="mb-3 font-semibold text-navy">Onboarding</h2>
            <OnboardingChecklist items={onboarding.map((o) => ({ id: o.id, label: o.label, done: o.done }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
