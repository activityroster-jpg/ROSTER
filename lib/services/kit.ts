import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { courseTypeEquipment as courseTypeEquipmentTable } from "@/lib/db/schema";
import { cleanKitRules, kitFromRules, type KitRule } from "@/lib/domain/kit";
import { runAtomic } from "@/lib/db/batch";
import { auditStatement } from "./audit";

/** Kit rules per course type (lib/domain/kit). */
export async function getKitRules(repos: Repositories, ctx: AnyTenantContext): Promise<Map<string, KitRule[]>> {
  const rows = await repos.tenant.courseTypeEquipment.list(ctx);
  const out = new Map<string, KitRule[]>();
  for (const r of rows) out.set(r.courseTypeId, [...(out.get(r.courseTypeId) ?? []), { equipmentTypeId: r.equipmentTypeId, quantity: r.quantity, perStudents: r.perStudents ?? null }]);
  return out;
}

/** Replace one course type's kit rules (one batch, audited). */
export async function setCourseTypeKit(repos: Repositories, ctx: AnyTenantContext, courseTypeId: string, input: readonly { equipmentTypeId: string; quantity: number; perStudents?: number | null }[]): Promise<{ ok: true; rules: KitRule[] } | { ok: false; error: string }> {
  const t = repos.tenant;
  if (!(await t.courseType.findById(ctx, courseTypeId))) return { ok: false, error: "Course type not found" };
  const types = new Set((await t.equipmentType.list(ctx)).filter((e) => e.active).map((e) => e.id));
  const rules = cleanKitRules(input, types);
  const existing = await t.courseTypeEquipment.list(ctx, eq(courseTypeEquipmentTable.courseTypeId, courseTypeId));
  const audit = auditStatement(repos, ctx, { action: "set_kit_rules", entity: "course_type", entityId: courseTypeId, before: existing.map((r) => ({ equipmentTypeId: r.equipmentTypeId, quantity: r.quantity, perStudents: r.perStudents })), after: rules });
  await runAtomic(repos.db, [
    ...existing.map((r) => t.courseTypeEquipment.deleteStatement(ctx, r.id)),
    ...rules.map((r) => t.courseTypeEquipment.insertStatement(ctx, { courseTypeId, equipmentTypeId: r.equipmentTypeId, quantity: r.quantity, perStudents: r.perStudents })),
    ...(audit ? [audit] : []),
  ]);
  return { ok: true, rules };
}

/** The kit a course of this type and size should have, when the centre uses kit rules; otherwise none. */
export async function suggestedKit(repos: Repositories, ctx: AnyTenantContext, courseTypeId: string, students: number): Promise<{ equipmentTypeId: string; quantity: number }[]> {
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  if (!settings?.useKitRules) return [];
  const rules = await repos.tenant.courseTypeEquipment.list(ctx, eq(courseTypeEquipmentTable.courseTypeId, courseTypeId));
  return kitFromRules(rules.map((r) => ({ equipmentTypeId: r.equipmentTypeId, quantity: r.quantity, perStudents: r.perStudents ?? null })), students);
}
