"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";

export type ActionState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  name: z.string().min(1),
  locationTypeId: z.string().optional(),
});

/** Add a location under an (optional) category. */
export async function createLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    locationTypeId: (formData.get("locationTypeId") as string) || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Give the location a name" };

  const created = await repos.tenant.location.insert(ctx, {
    name: parsed.data.name,
    locationTypeId: parsed.data.locationTypeId ?? null,
    active: true,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "location", entityId: created.id, after: created });
  revalidatePath("/office/locations");
  return { ok: true, message: "Location added" };
}

/** Deactivate/reactivate a location (deactivate-never-delete). */
export async function setLocationActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { ok: false, error: "Missing location" };
  const updated = await repos.tenant.location.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: active ? "reactivate" : "deactivate", entity: "location", entityId: id });
  revalidatePath("/office/locations");
  return { ok: true };
}
