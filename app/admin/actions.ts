"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getRepositories } from "@/lib/cf/bindings";
import { ORG_STATUSES, SUBSCRIPTION_STATUSES, PLANS, type OrgStatus, type SubscriptionStatus, type Plan } from "@/lib/db/schema";

type Result = { ok: boolean; error?: string };

export async function setOrgStatusAction(id: string, status: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(ORG_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { status: status as OrgStatus });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setSubscriptionStatusAction(id: string, sub: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(sub)) return { ok: false, error: "Invalid subscription status" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { subscriptionStatus: sub as SubscriptionStatus });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}

export async function setPlanAction(id: string, plan: string): Promise<Result> {
  await requirePlatformAdmin();
  if (!(PLANS as readonly string[]).includes(plan)) return { ok: false, error: "Invalid plan" };
  const { control } = await getRepositories();
  const updated = await control.updateOrganisation(id, { plan: plan as Plan });
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin");
  revalidatePath(`/admin/centres/${id}`);
  return { ok: true };
}
