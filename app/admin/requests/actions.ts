"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { featureRequestAdminSchema } from "@/lib/validation/feature-request";
import { emailStatusChange } from "@/lib/services/feature-requests";

export type RequestResult = { ok: boolean; error?: string };

/**
 * Dev Center edits to a centre's request: move it between stages, reword the
 * public title, keep it off the board, or leave a note for the centre. Moving
 * a request emails the person who sent it.
 */
export async function updateFeatureRequestAction(id: string, patch: { status?: string; publicTitle?: string; hidden?: boolean; responseToCentre?: string | null }): Promise<RequestResult> {
  await requirePlatformAdmin();
  const parsed = featureRequestAdminSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  const db = await getDb();
  const repo = new FeatureRequestRepository(db);
  const before = await repo.platformFind(id);
  if (!before) return { ok: false, error: "Not found" };
  const clean = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as typeof parsed.data;
  if (clean.status === before.status) delete clean.status;
  if (!Object.keys(clean).length) return { ok: true };
  const after = await repo.platformUpdate(id, clean);
  if (!after) return { ok: false, error: "Not found" };

  if (clean.status && clean.status !== "submitted" && before.submittedByUserId) {
    const to = (await new ControlPlaneRepository(db).userById(before.submittedByUserId).catch(() => null))?.email;
    if (to) {
      await emailStatusChange(to, {
        centreName: before.centreName,
        title: before.title,
        status: clean.status,
        response: after.responseToCentre,
        officeUrl: `https://${before.centreSlug}.${apexDomain()}/office/requests`,
      });
    }
  }
  revalidatePath("/admin/requests");
  return { ok: true };
}
