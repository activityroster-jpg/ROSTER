import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require";
import { getDocument } from "@/lib/r2";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { screenshotResponse } from "@/lib/services/feature-request-files";

export const dynamic = "force-dynamic";

/** A centre's own request screenshot. Other centres get a 404: the lookup is scoped to the caller's organisation, and so is the R2 key. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, repos } = await requireTenant({ permission: "office.view", allowReadOnly: true });
  const { id } = await params;
  const row = await new FeatureRequestRepository(repos.db).findForCentre(ctx, id);
  if (!row?.screenshotKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const object = await getDocument(ctx, row.screenshotKey);
  return screenshotResponse(object);
}
