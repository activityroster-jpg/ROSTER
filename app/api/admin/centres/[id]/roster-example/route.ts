import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { getDocument } from "@/lib/r2";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { isRosterExampleKey } from "@/lib/services/roster-example";

export const dynamic = "force-dynamic";

const TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/** A centre's roster example, for the Dev Center only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const org = await new PlatformRepository(await getDb()).organisationById(id);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The organisation comes from the stored centre, never from the request; the key must sit in its roster-example space.
  const ctx = { organisationId: org.id, slug: org.slug, system: true as const, reason: "dev-center: roster example" };
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!isRosterExampleKey(ctx, key)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const object = await getDocument(ctx, key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const type = object.httpMetadata?.contentType ?? "";
  return new Response(object.body, {
    headers: {
      "Content-Type": TYPES.has(type) ? type : "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(key.split("/").pop() ?? "roster").replace(/[^A-Za-z0-9._ -]/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
