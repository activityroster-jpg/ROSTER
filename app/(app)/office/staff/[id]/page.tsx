import { WhoCanSee, whoCanSeeText } from "@/components/office/WhoCanSee";
import { RetentionBanner } from "@/components/office/RetentionBanner";
import { AccessCard } from "@/components/office/AccessCard";
import { PersonDataTools } from "@/components/office/PersonDataTools";
import { GuideLink } from "@/components/GuideLink";
import { guardianLinksFor } from "@/lib/services/guardians";
import { can } from "@/lib/auth/rbac";
import { retentionPlan } from "@/lib/services/retention";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { ensureOnboarding, getStaffProfile } from "@/lib/services/hr";
import { fitReason } from "@/lib/services/staff";
import { OnboardingChecklist } from "@/components/office/OnboardingChecklist";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";
import { Card, StatusPill } from "@/components/ui";
import { EditInstructorForm } from "@/components/office/EditInstructorForm";
import { instructorReferences } from "@/lib/services/retire";
import { PayRateForm } from "@/components/office/PayRateForm";
import { listPayRates } from "@/lib/services/pay-rates";
import { hasFeature } from "@/lib/features";
import { ageOn, isUnder18 } from "@/lib/domain/age";
import { readProtectedContacts } from "@/lib/services/protected-contacts";
import { ProtectedContactsForm } from "@/components/office/ProtectedContactsForm";
import { parentApprovalFromLinks } from "@/lib/services/guardians";
import { StaffAvailabilityCard } from "@/components/office/StaffAvailabilityCard";
import { StaffLicencesCourses } from "@/components/office/StaffLicencesCourses";
import { eq } from "drizzle-orm";
import { instructorCourseType as instructorCourseTypeTable, qualification as qualificationTable } from "@/lib/db/schema";
import { staffAvailabilityView } from "@/lib/services/availability";
import { weekStart } from "@/lib/services/schedule";

export const dynamic = "force-dynamic";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, repos } = await requireTenant({ permission: "staff.view" });

  await ensureOnboarding(repos, ctx, id);
  const profile = await getStaffProfile(repos, ctx, id);

  if (!profile) {
    return (
      <Card>
        <p className="text-sm text-slate-600">That staff member wasn&apos;t found.</p>
        <Link href="/office/staff" className="mt-2 inline-block text-sm font-semibold text-teal hover:underline">← Back to instructors</Link>
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
  const availability = await staffAvailabilityView(repos, ctx, instructor.id, weekStart(new Date()));
  const centreMode = settings[0]?.staffManagedBy ?? "staff";
  const [qualTypes, courseTypes, held, teachRows] = await Promise.all([
    repos.tenant.qualificationType.list(ctx),
    repos.tenant.courseType.list(ctx),
    repos.tenant.qualification.list(ctx, eq(qualificationTable.instructorId, instructor.id)),
    repos.tenant.instructorCourseType.list(ctx, eq(instructorCourseTypeTable.instructorId, instructor.id)),
  ]);
  const under18 = isUnder18(instructor.dateOfBirth);
  const age = ageOn(instructor.dateOfBirth);
  const canEdit = can(ctx, "staff.edit");
  const canProtected = can(ctx, "protected.view");
  const contacts = canProtected ? await readProtectedContacts(repos, ctx, instructor) : { guardianName: "", guardianPhone: "", guardianEmail: "", emergencyName: "", emergencyPhone: "", emergencyRelationship: "" };
  const guardians = under18 ? await guardianLinksFor(repos, ctx, instructor.id) : [];
  const retention = left && !instructor.anonymisedAt ? await retentionPlan(repos, ctx, settings[0], new Date()) : null;
  const scheduled = retention?.staffDue.find((x) => x.id === instructor.id) ?? null;
  const hasPermissionSlot = documents.some((d) => /parental permission/i.test(d.name));
  const docItems: DocItem[] = documents.map((d) => ({
    kind: d.kind, itemId: d.itemId, name: d.name, expiryDate: d.expiryDate, mandatory: d.mandatory, hasFile: d.hasFile, docKey: d.docKey, verified: d.verified, noFile: d.noFile,
  }));

  return (
    <div>
      <Link href="/office/staff" className="text-sm text-slate-400 hover:text-slate-600">← Instructors</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">{instructor.name}{left ? <span className="ml-2 align-middle rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Left</span> : null}{under18 ? <span className="ml-2 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Under 18</span> : null}{instructor.restrictedAt ? <span className="ml-2 align-middle rounded-full bg-port/10 px-2 py-0.5 text-xs font-semibold text-port" title={instructor.restrictedReason ?? ""}>Restricted</span> : null}{instructor.anonymisedAt ? <span className="ml-2 align-middle rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Anonymised</span> : null}</h1>
          <p className="text-sm text-slate-500"><span className="capitalize">{instructor.employmentType}</span> · {instructor.email ?? "no email"}{instructor.phone ? ` · ${instructor.phone}` : ""}{age !== null ? ` · ${age} years old` : " · no date of birth yet"}</p>
        </div>
        <div className="flex items-center gap-3">
          {availability.officeManaged && !instructor.userId && !left ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" title="The office keeps their availability; they don't need the app">Office-managed · no sign-up needed</span> : null}
          {instructor.email && !left ? <InviteInstructorButton instructorId={instructor.id} status={inviteStatus} /> : null}
          {left ? null : fit.fit ? <StatusPill tone="covered">Fit to roster</StatusPill> : <StatusPill tone="conflict">{fitReason(fit) || "Not cleared"}</StatusPill>}
        </div>
      </div>
      {scheduled ? <RetentionBanner instructorId={instructor.id} deleteOn={scheduled.deleteOn.toISOString()} months={retention!.policy.staffMonths} /> : null}
      {canEdit ? <div className="mb-6"><EditInstructorForm instructor={{ id: instructor.id, name: instructor.name, email: instructor.email, phone: instructor.phone, employmentType: instructor.employmentType, status: instructor.status, dateOfBirth: instructor.dateOfBirth }} canDelete={(await instructorReferences(repos, ctx, instructor.id)).length === 0} /></div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-1 font-semibold text-navy">Licences &amp; documents</h2>
            <WhoCanSee repos={repos} ctx={ctx} feature="staff" className="mb-3" />
            <DocumentManager items={docItems} admin />
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-navy">Access</h2><GuideLink topic="roles" className="text-xs" /></div>
            <AccessCard instructorId={instructor.id} linked={Boolean(instructor.userId)} role={membership?.role ?? null} canManageGuardians={can(ctx, "protected.view")} parentApproval={parentApprovalFromLinks(instructor.dateOfBirth, guardians)} under18={under18} guardianEmailOnFile={Boolean(contacts.guardianEmail)} guardians={guardians.map((g) => ({ id: g.id, email: g.email, status: g.status, consentGivenAt: g.consentGivenAt?.toISOString() ?? null, consentNote: g.consentNote, createdAt: g.createdAt.toISOString() }))} />
          </Card>

          {canProtected ? (
          <Card>
            <h2 className="mb-1 font-semibold text-navy">Emergency &amp; guardian contacts <span className="text-xs font-normal text-slate-400">logged on every view</span></h2>
            <ProtectedContactsForm instructorId={instructor.id} initial={contacts} under18={under18} hasPermissionSlot={hasPermissionSlot} visibleTo={await whoCanSeeText(repos, ctx, "protected")} />
          </Card>
          ) : null}

          {can(ctx, "data.export") ? (
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-navy">Data &amp; privacy</h2><GuideLink topic="data" className="text-xs" /></div>
            <PersonDataTools instructorId={instructor.id} name={instructor.name} restricted={Boolean(instructor.restrictedAt)} restrictedReason={instructor.restrictedReason} anonymised={Boolean(instructor.anonymisedAt)} />
          </Card>
          ) : null}

          <Card>
            <h2 className="mb-2 font-semibold text-navy">Licences &amp; courses they can teach</h2>
            {canEdit && !left ? (
              <StaffLicencesCourses
                instructorId={instructor.id}
                name={instructor.name.split(" ")[0] ?? instructor.name}
                licenceTypes={qualTypes.filter((q) => q.active).sort((a, b) => a.rank - b.rank).map((q) => ({ id: q.id, name: q.name }))}
                heldTypeIds={held.map((q) => q.qualificationTypeId)}
                courseTypes={courseTypes.filter((c) => c.active && c.listed).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, group: c.category || (c.audience === "youth" ? "Youth" : c.audience === "adult" ? "Adult" : "Courses") }))}
                teaches={teachRows.map((r) => r.courseTypeId)}
              />
            ) : approvedCourses.length === 0 ? (
              <p className="text-sm text-slate-400">None set yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {approvedCourses.map((c) => <li key={c.id} className="rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">{c.name}</li>)}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {!left && can(ctx, "roster.edit") ? (
            <Card>
              <div id="availability" className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-navy">Availability</h2><a href="/office/availability" className="text-xs text-teal hover:underline">Everyone&rsquo;s week →</a></div>
              <StaffAvailabilityCard
                instructorId={instructor.id}
                name={instructor.name.split(" ")[0] ?? instructor.name}
                managedBy={instructor.managedBy ?? null}
                centreMode={centreMode}
                officeManaged={availability.officeManaged}
                hasLogin={Boolean(instructor.userId)}
                pattern={availability.pattern}
                days={availability.days}
                cells={availability.cells}
                canEditStaff={canEdit}
              />
            </Card>
          ) : null}
          {payOn && can(ctx, "finance.view") ? (
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
