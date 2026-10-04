"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { OPTIONAL_FEATURES, type OptionalFeature } from "@/lib/db/schema";
import { parseFeatures, serializeFeatures } from "@/lib/features";
import { writeAudit } from "@/lib/services/audit";

type Result = { ok: boolean; error?: string };

/** Switch an optional capability on for this centre (adds it to enabledFeatures). */
export async function enableFeatureAction(feature: string): Promise<Result> {
  if (!(OPTIONAL_FEATURES as readonly string[]).includes(feature)) return { ok: false, error: "Unknown feature" };
  const { ctx, repos } = await requireTenant({ permission: "settings.edit" });

  const existing = (await repos.tenant.orgSettings.list(ctx))[0];
  const current = parseFeatures(existing?.enabledFeatures);
  if (current.includes(feature as OptionalFeature)) return { ok: true };
  const next = serializeFeatures([...current, feature as OptionalFeature]);

  if (existing) {
    await repos.tenant.orgSettings.update(ctx, existing.id, { enabledFeatures: next });
  } else {
    await repos.tenant.orgSettings.insert(ctx, { enabledFeatures: next });
  }
  await writeAudit(repos, ctx, { action: "enable_feature", entity: "org_settings", after: { feature } });
  revalidatePath("/office");
  revalidatePath("/office/equipment");
  revalidatePath("/office/locations");
  revalidatePath("/office/finance");
  return { ok: true };
}
