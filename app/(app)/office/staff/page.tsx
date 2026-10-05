import { requireTenant } from "@/lib/tenant/require";
import { isUnder18 } from "@/lib/domain/age";
import { listStaffWithFit } from "@/lib/services/staff";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { Card } from "@/components/ui";
import { JoinRequests, type JoinRequestRow } from "@/components/office/JoinRequests";
import { AddInstructorForm } from "@/components/office/AddInstructorForm";
import { StaffTable, type StaffRow } from "@/components/office/StaffTable";
import { GuideLink } from "@/components/GuideLink";
import { OfficeAccess } from "@/components/office/OfficeAccess";
import { listOfficeMembers } from "@/lib/services/office-access";
import { parentApprovalFromLinks } from "@/lib/services/guardians";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { ctx, repos } = await requireTenant({ permission: "staff.view" });
  const [staff, qualTypes, teaching, courseTypes, complianceTypes] = await Promise.all([
    listStaffWithFit(repos, ctx),
    repos.tenant.qualificationType.list(ctx),
    getTeachingMatrix(repos, ctx),
    repos.tenant.courseType.list(ctx),
    repos.tenant.complianceType.list(ctx),
  ]);
  const qualChoices = qualTypes
    .filter((q) => q.active)
    .sort((a, b) => a.rank - b.rank)
    .map((q) => ({ id: q.id, name: q.name }));
  const courseChoices = courseTypes
    .filter((c) => c.active && c.listed)
    .map((c) => ({ id: c.id, name: c.name, audience: c.audience, scheme: c.scheme, category: c.category }));
  const checkChoices = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, name: c.name, mandatory: Boolean(c.mandatory) }));

  const membershipStatus = await repos.control.membershipStatusByUser(ctx.organisationId);
  const officeMembers = await listOfficeMembers(repos, ctx);
  const links = await repos.tenant.guardianLink.list(ctx);
  const inviteStatusFor = (userId: string | null): StaffRow["inviteStatus"] => {
    if (!userId) return "none";
    return membershipStatus.get(userId) === "active" ? "accepted" : "pending";
  };
  const pendingRequests: JoinRequestRow[] = staff
    .filter(({ instructor }) => instructor.status === "pending")
    .map(({ instructor }) => ({
      id: instructor.id, name: instructor.name, email: instructor.email, phone: instructor.phone,
      requestedAt: instructor.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    }));
  const rows: StaffRow[] = staff.filter(({ instructor }) => instructor.status !== "pending").map(({ instructor, fit }) => {
    const teach = teaching.get(instructor.id) ?? [];
    return {
      id: instructor.id,
      name: instructor.name,
      email: instructor.email,
      employment: instructor.employmentType,
      fit: fit.fit,
      warnings: fit.warnings.length,
      blockText: fit.blocks.map((b) => (b.kind === "missing" ? `${b.name} missing` : `${b.name} expired`)).join(", "),
      linked: Boolean(instructor.userId),
      inviteStatus: inviteStatusFor(instructor.userId),
      hasEmail: Boolean(instructor.email),
      teaches: teach.map((c) => c.name),
      teachesYouth: teach.some((c) => c.audience === "youth" || c.audience === "all"),
      teachesAdult: teach.some((c) => c.audience === "adult" || c.audience === "all"),
      status: instructor.status,
      under18: isUnder18(instructor.dateOfBirth),
      parentApproval: parentApprovalFromLinks(instructor.dateOfBirth, links.filter((l) => l.instructorId === instructor.id)),
      hasDob: Boolean(instructor.dateOfBirth),
      restricted: Boolean(instructor.restrictedAt),
      anonymised: Boolean(instructor.anonymisedAt),
    };
  });
  const currentCount = rows.filter((r) => r.status !== "inactive").length;
  const missingDob = rows.filter((r) => r.status !== "inactive" && !r.hasDob).length;
  const under18Count = rows.filter((r) => r.status !== "inactive" && r.under18).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Instructors</h1>
          <p className="text-sm text-slate-500">{currentCount} instructor{currentCount === 1 ? "" : "s"}{under18Count ? ` · ${under18Count} under 18` : ""} · fit-to-roster and the courses each can teach, from the certs they hold</p>
          {missingDob ? <p className="mt-1 text-xs text-amber-700">{missingDob} {missingDob === 1 ? "person has" : "people have"} no date of birth yet. Add it from their profile so under-18 protections and working-hours rules apply correctly.</p> : null}
        </div>
        <div className="flex flex-none items-center gap-3">
          <GuideLink topic="staff" />
          <a href="/office/staff/import" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Import from spreadsheet</a>
        </div>
      </div>

      <JoinRequests rows={pendingRequests} />

      <Card className="mb-5">
        <div id="office-access" className="mb-1 flex scroll-mt-20 items-center justify-between"><h2 className="font-semibold text-navy">Office access</h2><GuideLink topic="roles" className="text-xs" /></div>
        <p className="mb-2 text-xs text-slate-500">Who can open the office, and which parts. {ctx.role === "owner" ? "Tick what each office admin can reach; a new office admin starts with nothing ticked." : "Only the superadmin can change this."}</p>
        <OfficeAccess members={officeMembers.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role, status: m.status, features: m.features }))} isOwner={ctx.role === "owner"} meId={ctx.userId} />
      </Card>

      <Card className="mb-5">
        <h2 className="mb-1 font-semibold text-navy">Add an instructor</h2>
        <p className="mb-3 text-xs text-slate-500">Enter their details and what they teach — we email them an invite to set up their account and upload their certs. Or give them your company code (Settings) and they can join from the app.</p>
        <AddInstructorForm courses={courseChoices} quals={qualChoices} checks={checkChoices} />
      </Card>

      <StaffTable rows={rows} />
    </div>
  );
}
