import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import {
  onboardingItem as onboardingTable,
  qualification as qualificationTable,
  complianceItem as complianceItemTable,
  type Instructor,
  type OnboardingItem,
} from "@/lib/db/schema";
import { evaluateFit, type ComplianceRequirement, type HeldCompliance, type FitResult } from "@/lib/domain";
import { writeAudit } from "./audit";

/** The default onboarding checklist seeded for a new staff member. */
export const DEFAULT_ONBOARDING = [
  "Contract signed",
  "Induction & site tour",
  "Safeguarding training",
  "First Aid confirmed",
  "Kit issued",
  "Added to payroll",
] as const;

export interface DocumentRow {
  kind: "qualification" | "compliance";
  name: string;
  reference: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  mandatory: boolean;
  hasFile: boolean;
}

export interface StaffProfile {
  instructor: Instructor;
  fit: FitResult;
  documents: DocumentRow[];
  onboarding: OnboardingItem[];
  onboardingPct: number;
}

/** Seed the default onboarding checklist for an instructor if they have none. */
export async function ensureOnboarding(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<OnboardingItem[]> {
  const existing = await repos.tenant.onboardingItem.list(ctx, eq(onboardingTable.instructorId, instructorId));
  if (existing.length > 0) return existing.sort((a, b) => a.sortOrder - b.sortOrder);

  const created = await repos.tenant.onboardingItem.insertMany(
    ctx,
    DEFAULT_ONBOARDING.map((label, i) => ({ instructorId, label, done: false, sortOrder: i, completedAt: null })),
  );
  return created.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Tick / untick an onboarding step. Tenant scoped, audited. */
export async function toggleOnboarding(
  repos: Repositories,
  ctx: AnyTenantContext,
  itemId: string,
  done: boolean,
): Promise<OnboardingItem | null> {
  const updated = await repos.tenant.onboardingItem.update(ctx, itemId, { done, completedAt: done ? new Date() : null });
  if (updated) await writeAudit(repos, ctx, { action: "onboarding_toggle", entity: "onboarding_item", entityId: itemId, after: { done } });
  return updated;
}

/** Full HR profile for one instructor: documents, onboarding and fit status. */
export async function getStaffProfile(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<StaffProfile | null> {
  const instructor = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!instructor) return null;

  const [quals, qualTypes, items, complianceTypes, onboarding, settingsRows] = await Promise.all([
    repos.tenant.qualification.list(ctx, eq(qualificationTable.instructorId, instructorId)),
    repos.tenant.qualificationType.list(ctx),
    repos.tenant.complianceItem.list(ctx, eq(complianceItemTable.instructorId, instructorId)),
    repos.tenant.complianceType.list(ctx),
    repos.tenant.onboardingItem.list(ctx, eq(onboardingTable.instructorId, instructorId)),
    repos.tenant.orgSettings.list(ctx),
  ]);

  const qualTypeById = new Map(qualTypes.map((q) => [q.id, q]));
  const compTypeById = new Map(complianceTypes.map((c) => [c.id, c]));

  const documents: DocumentRow[] = [
    ...quals.map((q) => ({
      kind: "qualification" as const,
      name: qualTypeById.get(q.qualificationTypeId)?.name ?? "Qualification",
      reference: q.certNo,
      issueDate: q.issueDate,
      expiryDate: q.expiryDate,
      mandatory: false,
      hasFile: Boolean(q.docKey),
    })),
    ...items.map((it) => ({
      kind: "compliance" as const,
      name: compTypeById.get(it.complianceTypeId)?.name ?? "Compliance",
      reference: it.reference,
      issueDate: it.issueDate,
      expiryDate: it.expiryDate,
      mandatory: compTypeById.get(it.complianceTypeId)?.mandatory ?? false,
      hasFile: Boolean(it.docKey),
    })),
  ];

  const requirements: ComplianceRequirement[] = complianceTypes
    .filter((c) => c.active)
    .map((c) => ({ complianceTypeId: c.id, name: c.name, mandatory: c.mandatory, expiryTracked: c.expiryTracked }));
  const held: HeldCompliance[] = items.map((it) => ({ complianceTypeId: it.complianceTypeId, expiryDate: it.expiryDate ?? null }));
  const fit = evaluateFit(requirements, held, Date.now(), settingsRows[0]?.alertLeadDays ?? 30);

  const sortedOnboarding = onboarding.sort((a, b) => a.sortOrder - b.sortOrder);
  const done = sortedOnboarding.filter((o) => o.done).length;
  const onboardingPct = sortedOnboarding.length ? Math.round((done / sortedOnboarding.length) * 100) : 0;

  return { instructor, fit, documents, onboarding: sortedOnboarding, onboardingPct };
}
