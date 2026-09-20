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
