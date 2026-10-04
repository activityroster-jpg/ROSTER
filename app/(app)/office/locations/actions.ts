"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { writeAudit } from "@/lib/services/audit";
import { deleteOrRetireLocation } from "@/lib/services/retire";
import { idSchema } from "@/lib/validation/actions";

export type ActionState = { ok: boolean; error?: string; message?: string };

const schema = z.object({
  name: z.string().min(1),
  locationTypeId: z.string().optional(),
});

/** Add a location under an (optional) category. */
export async function createLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    locationTypeId: (formData.get("locationTypeId") as string) || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Give the location a name" };
  if (parsed.data.locationTypeId && !(await repos.tenant.locationType.findById(ctx, parsed.data.locationTypeId))) return { ok: false, error: "Pick one of your categories" };

  const created = await repos.tenant.location.insert(ctx, {
    name: parsed.data.name,
    locationTypeId: parsed.data.locationTypeId ?? null,
    active: true,
  });
  await writeAudit(repos, ctx, { action: "create", entity: "location", entityId: created.id, after: created });
  revalidatePath("/office/locations");
  return { ok: true, message: "Location added" };
}

/** Add a location category (a location type) the centre can then file locations under. */
export async function createLocationCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the category a name" };
  const created = await repos.tenant.locationType.insert(ctx, { name, active: true });
  await writeAudit(repos, ctx, { action: "create", entity: "location_type", entityId: created.id, after: created });
  revalidatePath("/office/locations");
  return { ok: true, message: `“${name}” category added` };
}

/** Rename a location category (moved here from Settings). */
export async function renameLocationCategoryAction(id: string, name: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const clean = (name ?? "").trim();
  if (!clean) return { ok: false, error: "Give the category a name" };
  const updated = await repos.tenant.locationType.update(ctx, id, { name: clean.slice(0, 120) });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: "rename", entity: "location_type", entityId: id, after: { name: clean } });
  revalidatePath("/office/locations");
  return { ok: true };
}

/** Retire / bring back a location category (deactivate-never-delete). */
export async function setLocationCategoryActiveAction(id: string, active: boolean): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const updated = await repos.tenant.locationType.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: active ? "reactivate" : "deactivate", entity: "location_type", entityId: id });
  revalidatePath("/office/locations");
  return { ok: true };
}

/** Delete a location nothing has ever used; otherwise retire it so old courses keep rendering. */
export async function deleteOrRetireLocationAction(id: string): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  const r = await deleteOrRetireLocation(repos, ctx, id);
  if (r.outcome === "not_found") return { ok: false, error: "Not found" };
  revalidatePath("/office/locations");
  revalidatePath("/office/courses");
  return { ok: true, message: r.outcome === "deleted" ? `${r.name} deleted` : `${r.name} retired (${r.because})` };
}

/** Deactivate/reactivate a location (deactivate-never-delete). */
export async function setLocationActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { ok: false, error: "Missing location" };
  const updated = await repos.tenant.location.update(ctx, id, { active });
  if (!updated) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: active ? "reactivate" : "deactivate", entity: "location", entityId: id });
  revalidatePath("/office/locations");
  return { ok: true };
}
