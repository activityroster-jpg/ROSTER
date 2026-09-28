import { requireTenant } from "@/lib/tenant/require";
import { OnboardingWizard, type CourseTypeOpt, type QualOpt, type TeamMember } from "@/components/office/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { ctx, repos, organisation } = await requireTenant({ role: "admin" });
  const [courseTypes, quals, instructors] = await Promise.all([
    repos.tenant.courseType.list(ctx),
    repos.tenant.qualificationType.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);

  const courseOpts: CourseTypeOpt[] = [...courseTypes]
    .sort((a, b) => (a.scheme ?? "").localeCompare(b.scheme ?? "") || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, scheme: c.scheme, active: Boolean(c.active) }));
  const qualOpts: QualOpt[] = quals
    .filter((q) => q.active)
    .sort((a, b) => a.rank - b.rank)
    .map((q) => ({ id: q.id, name: q.name, discipline: q.discipline }));
  const staff: TeamMember[] = instructors.map((i) => ({ name: i.name, employment: i.employmentType, quals: 0 }));

  return <OnboardingWizard centreName={organisation.name} courseTypes={courseOpts} quals={qualOpts} existingStaff={staff} />;
}
