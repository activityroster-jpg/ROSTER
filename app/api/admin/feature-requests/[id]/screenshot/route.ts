import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { getDocument } from "@/lib/r2";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { screenshotResponse } from "@/lib/services/feature-request-files";

export const dynamic = "force-dynamic";

/** A request's private screenshot, for the Dev Center only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const row = await new FeatureRequestRepository(await getDb()).platformFind(id);
  if (!row?.screenshotKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The key's organisation comes from the stored row, never from the request.
  const object = await getDocument({ organisationId: row.organisationId, slug: row.centreSlug, system: true, reason: "dev-center: feature request screenshot" }, row.screenshotKey);
  return screenshotResponse(object);
}
