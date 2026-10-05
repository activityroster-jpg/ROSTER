"use server";

import { staleEditMessage } from "@/lib/services/concurrency";
import { expectedVersionSchema, idSchema } from "@/lib/validation/actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { markApproval, rebuildHoursFromRoster } from "@/lib/services/hours";
import { getPayrollLines } from "@/lib/services/finance";
import { HOURS_SOURCES, PAY_SOURCES, type HoursSource, type PaySource } from "@/lib/db/schema";

export type PayrollResult = { ok: boolean; error?: string; message?: string; /** The line's new last-changed time after an edit. */ version?: number };

const linePatch = z.object({
  source: z.enum(HOURS_SOURCES).optional(),
  overrideMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  overridePay: z.number().min(0).max(100_000).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
  approved: z.boolean().optional(),
});
export type PayrollLinePatch = z.infer<typeof linePatch>;

function revalidate() {
  revalidatePath("/office/finance");
  revalidatePath("/portal/hours");
}

/** Edit one payroll line during review: which minutes to pay on, overrides, note, approval. */
export async function updatePayrollLineAction(recordId: string, patch: PayrollLinePatch, expectedVersion?: number | null): Promise<PayrollResult> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const parsed = linePatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Please check the values" };
  const version = expectedVersionSchema.safeParse(expectedVersion);
  if (!idSchema.safeParse(recordId).success || !version.success) return { ok: false, error: "Invalid request" };
  const current = await repos.tenant.hoursRecord.findById(ctx, recordId);
  if (!current) return { ok: false, error: "Line not found" };
  const stale = await staleEditMessage(repos, ctx, { entity: "hours_record", id: recordId, updatedAt: current.updatedAt, expected: version.data });
  if (stale) return { ok: false, error: stale };
  const clean = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if ("note" in clean) clean.note = (clean.note as string | null)?.trim() || null;
  if ("overridePay" in clean) clean.overridePayPence = clean.overridePay == null ? null : Math.round((clean.overridePay as number) * 100);
  if ("approved" in clean) {
    const approved = clean.approved as boolean;
    delete clean.approved;
    if (!(await markApproval(repos, ctx, recordId, approved))) return { ok: false, error: "Line not found" };
  }
  if (Object.keys(clean).length) {
    const updated = await repos.tenant.hoursRecord.update(ctx, recordId, clean);
    if (!updated) return { ok: false, error: "Line not found" };
  }
  await writeAudit(repos, ctx, { action: "payroll_line_edit", entity: "hours_record", entityId: recordId, after: clean });
  revalidate();
  return { ok: true, version: (await repos.tenant.hoursRecord.findById(ctx, recordId))?.updatedAt.getTime() };
}

/** Approve (or un-approve) a set of lines, e.g. everything shown for the period. */
export async function approvePayrollLinesAction(recordIds: string[], approved: boolean): Promise<PayrollResult> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const ids = [...new Set((recordIds ?? []).filter((id) => typeof id === "string" && id.length <= 64))].slice(0, 2000);
  let n = 0;
  for (const id of ids) if (await markApproval(repos, ctx, id, approved)) n++;
  await writeAudit(repos, ctx, { action: approved ? "payroll_approve" : "payroll_unapprove", entity: "hours_record", after: { count: n } });
  revalidate();
  return { ok: true, message: `${n} line${n === 1 ? "" : "s"} ${approved ? "approved" : "re-opened"}` };
}

/**
 * The centre's default: pay what was rostered, or what was clocked. Optionally
 * applies it to every unapproved line in a period too.
 */
export async function setPaySourceAction(source: string, apply?: { from?: string; to?: string }): Promise<PayrollResult> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  if (!(PAY_SOURCES as readonly string[]).includes(source)) return { ok: false, error: "Pick roster or clock" };
  const src = source as PaySource;
  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) await repos.tenant.orgSettings.update(ctx, existing.id, { paySource: src });
  else await repos.tenant.orgSettings.insert(ctx, { paySource: src });
  let changed = 0;
  if (apply) {
    const { lines } = await getPayrollLines(repos, ctx, { from: apply.from, to: apply.to });
    for (const l of lines) {
      if (l.approved || l.overrideMinutes != null || l.source === src) continue;
      if (await repos.tenant.hoursRecord.update(ctx, l.recordId, { source: src as HoursSource })) changed++;
    }
  }
  await writeAudit(repos, ctx, { action: "set_pay_source", entity: "org_settings", after: { source: src, applied: changed } });
  revalidate();
  revalidatePath("/office/settings");
  return { ok: true, message: apply ? `Default set to ${src}; ${changed} line${changed === 1 ? "" : "s"} switched` : `Default set to ${src}` };
}

/** Recreate missing hours lines from the roster (safe: never touches approved or edited lines). */
export async function rebuildHoursAction(): Promise<PayrollResult> {
  const { ctx, repos } = await requireTenant({ permission: "finance.view" });
  const r = await rebuildHoursFromRoster(repos, ctx);
  await writeAudit(repos, ctx, { action: "payroll_rebuild", entity: "hours_record", after: r });
  revalidate();
  return { ok: true, message: `Roster hours refreshed — ${r.created} added, ${r.updated} updated, ${r.removed} removed` };
}
