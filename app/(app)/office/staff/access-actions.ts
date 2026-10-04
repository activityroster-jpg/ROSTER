"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant/require";
import { getAuth } from "@/lib/auth";
import { apexDomain } from "@/lib/config";
import { instructor as instructorTable } from "@/lib/db/schema";
import { OFFICE_FEATURES } from "@/lib/auth/rbac";
import { inviteOfficeAdmin, removeOfficeAccess, setOfficeFeatures } from "@/lib/services/office-access";

const centreUrl = (slug: string, path: string) => `https://${slug}.${apexDomain()}${path}`;

export type AccessResult = { ok: boolean; error?: string; message?: string };

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  features: z.array(z.enum(OFFICE_FEATURES)).default([]),
});

/** Superadmin only: invite an office admin with the features ticked. */
export async function inviteOfficeAdminAction(input: { name: string; email: string; features: string[] }): Promise<AccessResult> {
  const { ctx, repos, organisation } = await requireTenant({ owner: true });
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const r = await inviteOfficeAdmin(repos, ctx, parsed.data);
  if (!r.ok) return r;
  try {
    const auth = await getAuth();
    await auth.api.signInMagicLink({ body: { email: r.email, callbackURL: centreUrl(organisation.slug, "/office") }, headers: new Headers(await headers()) });
  } catch (err) {
    console.error("[office-access] magic link send failed:", (err as Error).message);
  }
  revalidatePath("/office/staff");
  return { ok: true, message: r.alreadyMember ? `Office access updated for ${r.email}` : `Invite sent to ${r.email}` };
}

/** Superadmin only: change what an office admin can reach. */
export async function setOfficeFeaturesAction(userId: string, features: string[]): Promise<AccessResult> {
  const { ctx, repos } = await requireTenant({ owner: true });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return { ok: false, error: "Not found" };
  const r = await setOfficeFeatures(repos, ctx, userId, features);
  revalidatePath("/office/staff");
  return r.ok ? { ok: true, message: "Saved" } : r;
}

/** Superadmin only: take office access away (an instructor record keeps the app). */
export async function removeOfficeAccessAction(userId: string): Promise<AccessResult> {
  const { ctx, repos } = await requireTenant({ owner: true });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return { ok: false, error: "Not found" };
  const hasInstructor = (await repos.tenant.instructor.count(ctx, eq(instructorTable.userId, userId))) > 0;
  const r = await removeOfficeAccess(repos, ctx, userId, hasInstructor);
  revalidatePath("/office/staff");
  return r.ok ? { ok: true, message: hasInstructor ? "Office access removed; they keep the instructor app" : "Office access removed" } : r;
}
