"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import {
  complianceTypeSchema,
  orgSettingsSchema,
  qualificationTypeSchema,
  roleTypeSchema,
  sessionSlotSchema,
} from "@/lib/validation/entities";
import type { TenantRepositories } from "@/lib/db/repositories";

export type ActionState = { ok: boolean; error?: string; message?: string };

/** The editable config lists, each mapped to its repository. */
export type ConfigKind =
  | "slot"
  | "role"
  | "grade"
  | "compliance"
  | "equipmentType"
  | "locationType";

function repoFor(t: TenantRepositories, kind: ConfigKind) {
  switch (kind) {
    case "slot":
      return t.sessionSlot;
    case "role":
      return t.roleType;
    case "grade":
      return t.qualificationType;
    case "compliance":
      return t.complianceType;
    case "equipmentType":
      return t.equipmentType;
    case "locationType":
      return t.locationType;
  }
}

/** Update the org's general settings (one row per org: upsert). */
export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = orgSettingsSchema.safeParse({
    schedulingMode: formData.get("schedulingMode"),
    alertLeadDays: Number(formData.get("alertLeadDays")),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    enforceLicenceChecks: formData.get("enforceLicenceChecks") === "on",
    enforceRatioChecks: formData.get("enforceRatioChecks") === "on",
    enforceConflictChecks: formData.get("enforceConflictChecks") === "on",
    enforceAvailabilityChecks: formData.get("enforceAvailabilityChecks") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Please check the settings values" };

  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) {
    await repos.tenant.orgSettings.update(ctx, existing.id, parsed.data);
  } else {
    await repos.tenant.orgSettings.insert(ctx, parsed.data);
  }
  await writeAudit(repos, ctx, { action: "update", entity: "org_settings", after: parsed.data });
  revalidatePath("/office/settings");
  return { ok: true, message: "Settings saved" };
}

/** Add a config item to one of the editable lists. */
export async function addConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const kind = String(formData.get("kind") ?? "") as ConfigKind;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required" };

  try {
    const t = repos.tenant;
    switch (kind) {
      case "slot": {
        const v = sessionSlotSchema.parse({
          code: formData.get("code"),
          label: name,
          startTime: formData.get("startTime"),
          endTime: formData.get("endTime"),
          sortOrder: 0,
          active: true,
        });
        await t.sessionSlot.insert(ctx, v);
        break;
      }
      case "role": {
        const v = roleTypeSchema.parse({
          name,
          code: code || name.toUpperCase().replace(/\s+/g, "_"),
          countsTowardRatio: formData.get("countsTowardRatio") === "on",
          isSafetyCover: formData.get("isSafetyCover") === "on",
          isFirstAider: formData.get("isFirstAider") === "on",
          active: true,
        });
        await t.roleType.insert(ctx, v);
        break;
      }
      case "grade": {
        const v = qualificationTypeSchema.parse({
          name,
          code: code || name.toUpperCase().replace(/\s+/g, "_"),
          rank: Number(formData.get("rank") ?? 0),
          discipline: (formData.get("discipline") as string) || undefined,
          expiryTracked: formData.get("expiryTracked") === "on",
          active: true,
        });
        await t.qualificationType.insert(ctx, { ...v, defaultValidMonths: v.defaultValidMonths ?? null });
        break;
      }
      case "compliance": {
        const v = complianceTypeSchema.parse({
          name,
          code: code || name.toUpperCase().replace(/\s+/g, "_"),
          mandatory: formData.get("mandatory") === "on",
          expiryTracked: formData.get("expiryTracked") === "on",
          active: true,
        });
        await t.complianceType.insert(ctx, v);
        break;
      }
      case "equipmentType":
        await t.equipmentType.insert(ctx, { name, inventoryTracked: formData.get("inventoryTracked") === "on", active: true });
        break;
      case "locationType":
        await t.locationType.insert(ctx, { name, active: true });
        break;
      default:
        return { ok: false, error: "Unknown config type" };
    }
  } catch {
    return { ok: false, error: "Please check the values" };
  }

  await writeAudit(repos, ctx, { action: "create", entity: `config:${kind}`, after: { name } });
  revalidatePath("/office/settings");
  revalidatePath("/office/course-setup");
  return { ok: true, message: `${name} added` };
}

/** Rename a config item (the "edit name" option beside deactivate). */
export async function setConfigNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const kind = String(formData.get("kind") ?? "") as ConfigKind;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, error: "Missing item" };
  if (!name) return { ok: false, error: "Enter a name" };

  const t = repos.tenant;
  let res: unknown = null;
  switch (kind) {
    case "slot": res = await t.sessionSlot.update(ctx, id, { label: name }); break;
    case "role": res = await t.roleType.update(ctx, id, { name }); break;
    case "grade": res = await t.qualificationType.update(ctx, id, { name }); break;
    case "compliance": res = await t.complianceType.update(ctx, id, { name }); break;
    case "equipmentType": res = await t.equipmentType.update(ctx, id, { name }); break;
    case "locationType": res = await t.locationType.update(ctx, id, { name }); break;
    default: return { ok: false, error: "Unknown config type" };
  }
  if (!res) return { ok: false, error: "Item not found" };

  await writeAudit(repos, ctx, { action: "rename", entity: `config:${kind}`, entityId: id, after: { name } });
  revalidatePath("/office/settings");
  revalidatePath("/office/course-setup");
  return { ok: true };
}

/** Deactivate/reactivate a config item (deactivate-never-delete). */
export async function setConfigActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const kind = String(formData.get("kind") ?? "") as ConfigKind;
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { ok: false, error: "Missing item" };

  const repo = repoFor(repos.tenant, kind);
  const updated = await repo.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Item not found" };

  await writeAudit(repos, ctx, {
    action: active ? "reactivate" : "deactivate",
    entity: `config:${kind}`,
    entityId: id,
  });
  revalidatePath("/office/settings");
  revalidatePath("/office/course-setup");
  return { ok: true };
}

/** Lunch/rest break rule: break of N minutes after working more than M; paid or unpaid. */
export async function updateBreakPolicyAction(input: { afterMinutes: number; breakMinutes: number; paid: boolean }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = z.object({
    afterMinutes: z.coerce.number().int().min(0).max(24 * 60),
    breakMinutes: z.coerce.number().int().min(0).max(240),
    paid: z.boolean(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the break values" };
  const patch = { breakAfterMinutes: parsed.data.afterMinutes, breakMinutes: parsed.data.breakMinutes, breakPaid: parsed.data.paid };
  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) await repos.tenant.orgSettings.update(ctx, existing.id, patch);
  else await repos.tenant.orgSettings.insert(ctx, patch);
  await writeAudit(repos, ctx, { action: "update_breaks", entity: "org_settings", after: patch });
  revalidatePath("/office/settings");
  revalidatePath("/office/finance");
  return { ok: true, message: "Break rule saved" };
}

/** Time clock on/off and whether payroll defaults to rostered or clocked hours. */
export async function updateTimeclockSettingsAction(input: { timeclockEnabled: boolean; paySource: string }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = z.object({ timeclockEnabled: z.boolean(), paySource: z.enum(["roster", "clock"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the values" };
  // Paying on the clock makes no sense with the clock off.
  const patch = { timeclockEnabled: parsed.data.timeclockEnabled, paySource: parsed.data.timeclockEnabled ? parsed.data.paySource : ("roster" as const) };
  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  if (existing) await repos.tenant.orgSettings.update(ctx, existing.id, patch);
  else await repos.tenant.orgSettings.insert(ctx, patch);
  await writeAudit(repos, ctx, { action: "update_timeclock", entity: "org_settings", after: patch });
  revalidatePath("/office/settings");
  revalidatePath("/office/finance");
  revalidatePath("/office");
  revalidatePath("/portal");
  return { ok: true, message: "Saved" };
}

/** Issue a new company code for the instructor app (the old one stops working). */
export async function regenerateJoinCodeAction(): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const before = await repos.control.ensureJoinCode(ctx.organisationId);
  const after = await repos.control.regenerateJoinCode(ctx.organisationId);
  await writeAudit(repos, ctx, { action: "regenerate_join_code", entity: "org_settings", before: { code: before }, after: { code: after } });
  revalidatePath("/office/settings");
  return { ok: true, message: "New company code issued" };
}
