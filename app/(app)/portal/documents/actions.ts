"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { instructor as instructorTable } from "@/lib/db/schema";
import { writeAudit } from "@/lib/services/audit";

export type DocActionResult = { ok: boolean; error?: string; message?: string };

/** Resolve the signed-in user's own instructor record in this centre. */
async function me() {
  const { ctx, repos } = await requireTenant();
  const row = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
  return { ctx, repos, instructor: row };
}

const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "LICENCE";

/** Add a licence from the centre's catalogue to my own record (to upload against). */
export async function addMyLicenceAction(qualificationTypeId: string): Promise<DocActionResult> {
  const { ctx, repos, instructor } = await me();
  if (!instructor) return { ok: false, error: "Your profile isn't linked yet." };
  const type = (await repos.tenant.qualificationType.list(ctx)).find((q) => q.id === qualificationTypeId && q.active);
  if (!type) return { ok: false, error: "Unknown licence." };
  await repos.tenant.qualification.insert(ctx, {
    instructorId: instructor.id, qualificationTypeId, certNo: null, issueDate: null, expiryDate: null, verified: false,
  });
  await writeAudit(repos, ctx, { action: "self_add_licence", entity: "qualification", entityId: instructor.id, after: { qualificationTypeId } });
  revalidatePath("/portal/documents");
  revalidatePath("/portal/welcome");
  return { ok: true, message: `${type.name} added — upload a photo of it below.` };
}

/** Add a licence the centre doesn't list yet: create the type, then add it to me.
 *  The centre can rename, verify or retire it later. */
export async function addMyCustomLicenceAction(name: string): Promise<DocActionResult> {
  const { ctx, repos, instructor } = await me();
  if (!instructor) return { ok: false, error: "Your profile isn't linked yet." };
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Give the licence a name." };

  const types = await repos.tenant.qualificationType.list(ctx);
  // Re-use an existing type with the same name (case-insensitive) if there is one.
  let type = types.find((t) => t.name.trim().toLowerCase() === clean.toLowerCase());
  if (!type) {
    const codes = new Set(types.map((t) => t.code));
    let code = slug(clean);
    while (codes.has(code)) code = `${slug(clean)}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    type = await repos.tenant.qualificationType.insert(ctx, {
      name: clean, code, rank: 0, discipline: null, expiryTracked: false, defaultValidMonths: null, active: true,
    });
    await writeAudit(repos, ctx, { action: "self_add_licence_type", entity: "qualification_type", entityId: type.id, after: { name: clean } });
  }
  await repos.tenant.qualification.insert(ctx, {
    instructorId: instructor.id, qualificationTypeId: type.id, certNo: null, issueDate: null, expiryDate: null, verified: false,
  });
  await writeAudit(repos, ctx, { action: "self_add_licence", entity: "qualification", entityId: instructor.id, after: { name: clean } });
  revalidatePath("/portal/documents");
  revalidatePath("/portal/welcome");
  return { ok: true, message: `${clean} added — upload a photo of it below.` };
}
