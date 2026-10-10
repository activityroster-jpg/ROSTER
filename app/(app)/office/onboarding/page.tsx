import { requireTenant } from "@/lib/tenant/require";
import { OnboardingWizard, type CourseTypeOpt, type QualOpt, type TeamMember } from "@/components/office/OnboardingWizard";
import { parseFeatures } from "@/lib/features";
import { trackerOffer } from "@/lib/services/onboarding-tracker";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const [courseTypes, quals, instructors, settings] = await Promise.all([
    repos.tenant.courseType.list(ctx),
    repos.tenant.qualificationType.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.orgSettings.list(ctx),
  ]);

  const courseOpts: CourseTypeOpt[] = [...courseTypes]
    .sort((a, b) => (a.category ?? a.scheme ?? "").localeCompare(b.category ?? b.scheme ?? "") || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, scheme: c.scheme, audience: c.audience, category: c.category, active: Boolean(c.active) }));
  const qualOpts: QualOpt[] = quals
    .filter((q) => q.active)
    .sort((a, b) => a.rank - b.rank)
    .map((q) => ({ id: q.id, name: q.name, discipline: q.discipline }));
  const staff: TeamMember[] = instructors.map((i) => ({ name: i.name, employment: i.employmentType, quals: 0 }));

  const s = settings[0];
  return (
    <OnboardingWizard
      centreName={organisation.name}
      courseTypes={courseOpts}
      quals={qualOpts}
      existingStaff={staff}
      initialFeatures={parseFeatures(s?.enabledFeatures)}
      initialSlotStyle={s?.slotStyle ?? "slots"}
      initialWeeksAhead={s?.availabilityWeeksAhead ?? 4}
      initialStaffManagedBy={s?.staffManagedBy ?? "staff"}
      initialTracker={await trackerOffer(repos, ctx)}
    />
  );
}
