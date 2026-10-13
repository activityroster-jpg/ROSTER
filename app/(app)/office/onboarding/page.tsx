import { packFor } from "@/lib/packs";
import { requireTenant } from "@/lib/tenant/require";
import { OnboardingWizard, type CourseTypeOpt, type TeamMember } from "@/components/office/OnboardingWizard";
import { parseFeatures } from "@/lib/features";
import { trackerOffer } from "@/lib/services/onboarding-tracker";
import { getTeachingData } from "@/lib/services/teaching";
import { listRosterExamples, type RosterExample } from "@/lib/services/roster-example";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  const [courseTypes, instructors, settings, teaching] = await Promise.all([
    repos.tenant.courseType.list(ctx),
    repos.tenant.instructor.list(ctx),
    repos.tenant.orgSettings.list(ctx),
    getTeachingData(repos, ctx, { includeInactive: true }),
  ]);

  const courseOpts: CourseTypeOpt[] = [...courseTypes]
    .sort((a, b) => (a.category ?? a.scheme ?? "").localeCompare(b.category ?? b.scheme ?? "") || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, scheme: c.scheme, audience: c.audience, category: c.category, active: Boolean(c.active) }));
  const staff: TeamMember[] = instructors.map((i) => ({ name: i.name, employment: i.employmentType, quals: 0 }));

  const s = settings[0];
  const joinCode = await repos.control.ensureJoinCode(ctx.organisationId).catch(() => null);
  let rosterExamples: RosterExample[] = [];
  try { rosterExamples = await listRosterExamples(ctx); } catch { /* storage unavailable: offer the upload anyway */ }
  return (
    <OnboardingWizard
      centreName={organisation.name}
      wording={packFor(organisation.activityType).wording}
      courseTypes={courseOpts}
      teaching={teaching}
      existingStaff={staff}
      initialFeatures={parseFeatures(s?.enabledFeatures)}
      initialSlotStyle={s?.slotStyle ?? "slots"}
      initialWeeksAhead={s?.availabilityWeeksAhead ?? 4}
      initialStaffManagedBy={s?.staffManagedBy ?? "staff"}
      initialTracker={await trackerOffer(repos, ctx)}
      joinCode={joinCode}
      rosterExamples={rosterExamples}
    />
  );
}
