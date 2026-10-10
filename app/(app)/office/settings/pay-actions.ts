"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { courseType as courseTypeTable, instructor as instructorTable, PAY_UNITS, roleType as roleTypeTable, type PayUnit } from "@/lib/db/schema";
import { idSchema } from "@/lib/validation/actions";
import { clearPayRate, setPayRate } from "@/lib/services/pay-rates";
import { repriceUnapprovedLines } from "@/lib/services/hours";

export type PayRatesResult = { ok: boolean; error?: string; message?: string };

const changeSchema = z.object({
  /** null = the centre's standard rate. */
  instructorId: idSchema.nullable(),
  roleTypeId: idSchema.nullable(),
  courseTypeId: idSchema.nullable(),
  unit: z.enum(PAY_UNITS),
  /** null = remove this rate. */
  rate: z.number().min(0).max(100_000).nullable(),
});
const saveSchema = z.object({
  changes: z.array(changeSchema).min(1).max(2000),
  /** Re-price unapproved payroll lines dated on or after this day (YYYY-MM-DD). */
  applyFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/**
 * Save pay rates from Settings → Pay rates or a staff profile: the centre's
 * standard rates, people's own rates and their course rates, in one go.
 * Lines with no rate yet pick up the new ones; with `applyFrom`, unapproved
 * lines from that day are re-priced too. Approved lines never change.
 */
export async function savePayRatesAction(input: unknown): Promise<PayRatesResult> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the amounts: numbers only, 0 or more." };
  const { changes, applyFrom } = parsed.data;

  // Every person, role and course named must belong to this centre.
  const distinct = (k: "instructorId" | "roleTypeId" | "courseTypeId") => [...new Set(changes.map((c) => c[k]).filter((x): x is string => Boolean(x)))];
  const [people, roles, types] = await Promise.all([
    distinct("instructorId").length ? repos.tenant.instructor.listIn(ctx, instructorTable.id, distinct("instructorId")) : [],
    distinct("roleTypeId").length ? repos.tenant.roleType.listIn(ctx, roleTypeTable.id, distinct("roleTypeId")) : [],
    distinct("courseTypeId").length ? repos.tenant.courseType.listIn(ctx, courseTypeTable.id, distinct("courseTypeId")) : [],
  ]);
  if (people.length !== distinct("instructorId").length || roles.length !== distinct("roleTypeId").length || types.length !== distinct("courseTypeId").length) {
    return { ok: false, error: "Something on this page is out of date. Reload it and try again." };
  }

  // The same rate twice in one save: the last one wins.
  const byKey = new Map<string, (typeof changes)[number]>();
  for (const c of changes) byKey.set(`${c.instructorId ?? ""}|${c.roleTypeId ?? ""}|${c.courseTypeId ?? ""}`, c);

  let saved = 0, removed = 0;
  for (const c of byKey.values()) {
    const key = { instructorId: c.instructorId, roleTypeId: c.roleTypeId, courseTypeId: c.courseTypeId };
    if (c.rate == null) { if (await clearPayRate(repos, ctx, key)) removed++; }
    else { await setPayRate(repos, ctx, { ...key, unit: c.unit as PayUnit, rate: c.rate }); saved++; }
  }

  // Lines that had no rate pick the new ones up; a change to the standard rates can reach anyone.
  const touched = [...byKey.values()];
  const everyone = touched.some((c) => !c.instructorId);
  const whose = everyone ? null : [...new Set(touched.map((c) => c.instructorId!))];
  await repriceUnapprovedLines(repos, ctx, { instructorIds: whose, onlyUnpriced: true });
  const applied = applyFrom ? await repriceUnapprovedLines(repos, ctx, { instructorIds: whose, fromIso: applyFrom }) : 0;

  revalidatePath("/office/settings");
  revalidatePath("/office/finance");
  revalidatePath("/office/staff", "layout");
  const parts = [saved ? `${saved} rate${saved === 1 ? "" : "s"} saved` : "", removed ? `${removed} removed` : ""].filter(Boolean).join(", ") || "Nothing changed";
  return { ok: true, message: applied ? `${parts}; ${applied} unapproved payroll line${applied === 1 ? "" : "s"} from ${applyFrom} re-priced.` : `${parts}.` };
}
