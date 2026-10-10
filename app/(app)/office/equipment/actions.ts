"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { EQUIPMENT_STATUSES } from "@/lib/db/schema";
import { deleteOrRetireEquipment, deleteOrRetireEquipmentType } from "@/lib/services/retire";
import { idSchema } from "@/lib/validation/actions";

export type ActionState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  equipmentTypeId: z.string().min(1),
  name: z.string().min(1),
  identifier: z.string().optional(),
});

/** Add a piece of equipment (tracked unit or bulk item). */
export async function createEquipmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = schema.safeParse({
    equipmentTypeId: formData.get("equipmentTypeId"),
    name: formData.get("name"),
    identifier: (formData.get("identifier") as string) || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Pick a type and give it a name" };
  if (!(await repos.tenant.equipmentType.findById(ctx, parsed.data.equipmentTypeId))) return { ok: false, error: "Pick one of your equipment types" };

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

/** Add (id = null) or edit an equipment type: its name, and whether each one is listed by name or it is just a number. */
export async function saveEquipmentTypeAction(id: string | null, input: EquipmentTypeInput): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = typeSchema.safeParse({ ...input, quantity: input.quantity ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the values" };
  // A type counted by name is counted from its listed units, so it keeps no number of its own.
  const data = parsed.data.inventoryTracked ? { ...parsed.data, quantity: null } : parsed.data;
  const t = repos.tenant.equipmentType;
  if (id) {
    const updated = await t.update(ctx, id, data);
    if (!updated) return { ok: false, error: "Not found" };
    await writeAudit(repos, ctx, { action: "update", entity: "equipment_type", entityId: id, after: data });
  } else {
    const created = await t.insert(ctx, { ...data, active: true });
    await writeAudit(repos, ctx, { action: "create", entity: "equipment_type", entityId: created.id, after: data });
  }
  revalidatePath("/office/equipment");
  revalidatePath("/office/settings");
  return { ok: true, message: id ? "Saved" : `${data.name} added` };
}

/** Retire / bring back an equipment type (deactivate-never-delete). */
export async function setEquipmentTypeActiveAction(id: string, active: boolean): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const updated = await repos.tenant.equipmentType.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: active ? "reactivate" : "deactivate", entity: "equipment_type", entityId: id });
  revalidatePath("/office/equipment");
  return { ok: true };
}

/** Available ↔ in maintenance for one unit (retiring goes through delete-or-retire). */
export async function setEquipmentUnitStatusAction(id: string, status: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(id).success || !["available", "maintenance"].includes(status)) return { ok: false, error: "Invalid status" };
  // Back in service: the maintenance reason and date go with it.
  const updated = await repos.tenant.equipment.update(ctx, id, status === "available" ? { status: "available", maintenanceNote: null, backOn: null } : { status: "maintenance" });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: "update_status", entity: "equipment", entityId: id, after: { status } });
  revalidatePath("/office/equipment");
  revalidatePath("/office");
  return { ok: true };
}

/** Delete a unit no course has ever used; otherwise retire it. */
export async function deleteOrRetireEquipmentAction(id: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  const r = await deleteOrRetireEquipment(repos, ctx, id);
  if (r.outcome === "not_found") return { ok: false, error: "Not found" };
  revalidatePath("/office/equipment");
  revalidatePath("/office/courses");
  return { ok: true, message: r.outcome === "deleted" ? `${r.name} deleted` : `${r.name} retired (${r.because})` };
}

/** Delete an equipment type with no units, courses or course types pointing at it; otherwise retire it. */
export async function deleteOrRetireEquipmentTypeAction(id: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  const r = await deleteOrRetireEquipmentType(repos, ctx, id);
  if (r.outcome === "not_found") return { ok: false, error: "Not found" };
  revalidatePath("/office/equipment");
  revalidatePath("/office/settings");
  return { ok: true, message: r.outcome === "deleted" ? `${r.name} deleted` : `${r.name} retired (${r.because})` };
}

/** Change an equipment item's status (available / maintenance / retired). */
export async function setEquipmentStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
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

const maintenanceSchema = z.object({
  note: z.string().trim().max(120, "Keep it short (120 characters)").transform((v) => v || null),
  backOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().or(z.literal("").transform(() => null)),
});

/** Why a unit is in maintenance and when it should be back; shown on the problems list. Plain text only. */
export async function setEquipmentMaintenanceAction(id: string, input: { note: string; backOn: string | null }): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = maintenanceSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !parsed.success) return { ok: false, error: parsed.success ? "Invalid request" : parsed.error.issues[0]?.message ?? "Check the details" };
  const unit = await repos.tenant.equipment.findById(ctx, id);
  if (!unit || unit.status !== "maintenance") return { ok: false, error: "Only kit in maintenance has a reason" };
  await repos.tenant.equipment.update(ctx, id, { maintenanceNote: parsed.data.note, backOn: parsed.data.backOn });
  await writeAudit(repos, ctx, { action: "set_maintenance_note", entity: "equipment", entityId: id, after: parsed.data });
  revalidatePath("/office/equipment");
  revalidatePath("/office");
  return { ok: true, message: "Saved" };
}
