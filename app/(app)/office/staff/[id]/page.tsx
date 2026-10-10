import { WhoCanSee, whoCanSeeText } from "@/components/office/WhoCanSee";
import { RetentionBanner } from "@/components/office/RetentionBanner";
import { AccessCard } from "@/components/office/AccessCard";
import { PersonDataTools } from "@/components/office/PersonDataTools";
import { GuideLink } from "@/components/GuideLink";
import { can } from "@/lib/auth/rbac";
import { retentionPlan } from "@/lib/services/retention";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant/require";
import { getStaffProfile } from "@/lib/services/hr";
import { trackerFor } from "@/lib/services/onboarding-tracker";
import { fitReason } from "@/lib/services/staff";
import { OnboardingChecklist } from "@/components/office/OnboardingChecklist";
import { DocumentManager, type DocItem } from "@/components/DocumentManager";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";
import { Card, StatusPill } from "@/components/ui";
import { EditInstructorForm } from "@/components/office/EditInstructorForm";
import { instructorReferences } from "@/lib/services/retire";
import { PersonPayRates } from "@/components/office/PayRatesEditor";
import { listCentreRates, listPayRates } from "@/lib/services/pay-rates";
import { hasFeature } from "@/lib/features";
import { ageOn, isUnder18 } from "@/lib/domain/age";
import { readProtectedContacts } from "@/lib/services/protected-contacts";
import { ProtectedContactsForm } from "@/components/office/ProtectedContactsForm";
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

  const profile = await getStaffProfile(repos, ctx, id);

  if (!profile) {
    return (
      <Card>
        <p className="text-sm text-slate-600">That staff member wasn&apos;t found.</p>
        <Link href="/office/staff" className="mt-2 inline-block text-sm font-semibold text-teal hover:underline">← Back to instructors</Link>
      </Card>
    );
  }

  const { instructor, fit, documents, approvedCourses } = profile;
  const [rates, centreRates, roles, settings] = await Promise.all([listPayRates(repos, ctx, id), listCentreRates(repos, ctx), repos.tenant.roleType.list(ctx), repos.tenant.orgSettings.list(ctx)]);
  const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
  const currency = SYMBOL[settings[0]?.currency ?? "GBP"] ?? "£";
  const payOn = hasFeature(settings[0]?.enabledFeatures, "payroll");
  const tracker = await trackerFor(repos, ctx, id);
  // Where to sort out an automatic onboarding step: the matching card on this page.
  const STEP_ANCHOR: Record<string, string | undefined> = {
    app: "#access", licences: "#licences", courses: "#licences", "first-aid": "#documents", vetting: "#documents",
    pay: payOn && can(ctx, "finance.view") ? "#pay" : undefined,
    availability: can(ctx, "roster.edit") ? "#availability" : undefined,
  };
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
  const retention = left && !instructor.anonymisedAt ? await retentionPlan(repos, ctx, settings[0], new Date()) : null;
  const scheduled = retention?.staffDue.find((x) => x.id === instructor.id) ?? null;
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
            <h2 id="documents" className="mb-1 scroll-mt-6 font-semibold text-navy">Licences &amp; documents</h2>
            <WhoCanSee repos={repos} ctx={ctx} feature="staff" className="mb-3" />
            <DocumentManager items={docItems} admin />
          </Card>


          <Card>
            <h2 id="licences" className="mb-2 scroll-mt-6 font-semibold text-navy">Licences &amp; courses they can teach</h2>
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
              <div id="pay" className="mb-1 flex scroll-mt-6 items-center justify-between"><h2 className="font-semibold text-navy">Pay</h2><a href="/learn?topic=pay-rates" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a></div>
              <p className="mb-3 text-xs text-slate-500">How {instructor.name.split(" ")[0] ?? instructor.name} is paid. Everyone&rsquo;s rates, and the standard rate for each role, are in <a href="/office/settings?tab=pay#pay-rates" className="font-medium text-teal hover:underline">Settings → Pay rates</a>.</p>
              <PersonPayRates
                currency={currency}
                person={{ id: instructor.id, name: instructor.name, employment: instructor.employmentType }}
                courses={courseTypes.filter((c) => (c.active && c.listed) || rates.some((r) => r.courseTypeId === c.id)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }))}
                roles={roles.map((r) => ({ id: r.id, name: r.name }))}
                rates={rates.map((r) => ({ instructorId: r.instructorId, roleTypeId: r.roleTypeId, courseTypeId: r.courseTypeId, unit: r.unit, rate: r.rate }))}
                standard={centreRates.filter((r) => !r.courseTypeId).map((r) => ({ label: r.roleTypeId ? (roles.find((x) => x.id === r.roleTypeId)?.name ?? "Role") : "anyone else", rate: r.rate, unit: r.unit }))}
              />
            </Card>
          ) : null}
          {tracker.on && tracker.total > 0 ? (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-navy">Onboarding</h2>
                <span className="flex items-center gap-3 text-xs">
                  {can(ctx, "settings.edit") ? <a href="/office/settings#onboarding-tracker" className="text-slate-500 hover:text-teal hover:underline">Change steps</a> : null}
                  <a href="/learn?topic=onboarding-tracker" target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">📖 Read the guide</a>
                </span>
              </div>
              <OnboardingChecklist items={tracker.items.map((t) => ({ key: t.key, label: t.label, done: t.done, auto: t.auto, hint: t.hint, rowId: t.rowId, href: STEP_ANCHOR[t.key] }))} />
            </Card>
          ) : null}
        </div>
      </div>

      {/* Access, contacts and data tools: needed now and then, so they sit at the bottom. */}
      <div className="mt-6 space-y-6">
          <Card>
            <div id="access" className="mb-2 flex scroll-mt-6 items-center justify-between"><h2 className="font-semibold text-navy">Access</h2><GuideLink topic="roles" className="text-xs" /></div>
            <AccessCard linked={Boolean(instructor.userId)} role={membership?.role ?? null} />
          </Card>

          {canProtected ? (
          <Card>
            <h2 className="mb-1 font-semibold text-navy">Emergency &amp; guardian contacts <span className="text-xs font-normal text-slate-400">logged on every view</span></h2>
            <ProtectedContactsForm instructorId={instructor.id} initial={contacts} under18={under18} visibleTo={await whoCanSeeText(repos, ctx, "protected")} />
          </Card>
          ) : null}

          {can(ctx, "data.export") ? (
          <Card>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-navy">Data &amp; privacy</h2><GuideLink topic="data" className="text-xs" /></div>
            <PersonDataTools instructorId={instructor.id} name={instructor.name} restricted={Boolean(instructor.restrictedAt)} restrictedReason={instructor.restrictedReason} anonymised={Boolean(instructor.anonymisedAt)} />
          </Card>
          ) : null}
      </div>
    </div>
  );
}
