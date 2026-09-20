"use server";

import { revalidatePath } from "next/cache";
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
