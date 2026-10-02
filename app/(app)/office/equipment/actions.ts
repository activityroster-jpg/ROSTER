"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { EQUIPMENT_STATUSES } from "@/lib/db/schema";

export type ActionState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  equipmentTypeId: z.string().min(1),
  name: z.string().min(1),
  identifier: z.string().optional(),
});

/** Add a piece of equipment (tracked unit or bulk item). */
export async function createEquipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = schema.safeParse({
    equipmentTypeId: formData.get("equipmentTypeId"),
    name: formData.get("name"),
    identifier: (formData.get("identifier") as string) || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Pick a type and give it a name" };

  const created = await repos.tenant.equipment.insert(ctx, {
    equipmentTypeId: parsed.data.equipmentTypeId,
    name: parsed.data.name,
    identifier: parsed.data.identifier ?? null,
    status: "available",
  });
  await writeAudit(repos, ctx, { action: "create", entity: "equipment", entityId: created.id, after: created });
  revalidatePath("/office/equipment");
  return { ok: true, message: "Equipment added" };
}

const typeSchema = z.object({
  name: z.string().trim().min(1, "Give the type a name").max(120),
  quantity: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).transform((v) => (v === "" ? null : v)),
  inventoryTracked: z.boolean(),
});

export interface EquipmentTypeInput { name: string; quantity: number | string | null; inventoryTracked: boolean }

/** Add (id = null) or edit an equipment type — name, quantity and tracked/bulk. */
export async function saveEquipmentTypeAction(id: string | null, input: EquipmentTypeInput): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = typeSchema.safeParse({ ...input, quantity: input.quantity ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the values" };
  const t = repos.tenant.equipmentType;
  if (id) {
    const updated = await t.update(ctx, id, parsed.data);
    if (!updated) return { ok: false, error: "Not found" };
    await writeAudit(repos, ctx, { action: "update", entity: "equipment_type", entityId: id, after: parsed.data });
  } else {
    const created = await t.insert(ctx, { ...parsed.data, active: true });
    await writeAudit(repos, ctx, { action: "create", entity: "equipment_type", entityId: created.id, after: parsed.data });
  }
  revalidatePath("/office/equipment");
  revalidatePath("/office/settings");
  return { ok: true, message: id ? "Saved" : `${parsed.data.name} added` };
}

/** Retire / bring back an equipment type (deactivate-never-delete). */
export async function setEquipmentTypeActiveAction(id: string, active: boolean): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const updated = await repos.tenant.equipmentType.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: active ? "reactivate" : "deactivate", entity: "equipment_type", entityId: id });
  revalidatePath("/office/equipment");
  return { ok: true };
}

/** Change an equipment item's status (available / maintenance / retired). */
export async function setEquipmentStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(EQUIPMENT_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  const updated = await repos.tenant.equipment.update(ctx, id, { status: status as (typeof EQUIPMENT_STATUSES)[number] });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: "update_status", entity: "equipment", entityId: id, after: { status } });
  revalidatePath("/office/equipment");
  return { ok: true };
}
