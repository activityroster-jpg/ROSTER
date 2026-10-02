import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { getDocument } from "@/lib/r2";
import { instructor as instructorTable } from "@/lib/db/schema";
import { ALLOWED_DOCUMENT_TYPES } from "@/lib/security/file-type";

export const dynamic = "force-dynamic";

/**
 * Stream a private document. `getDocument` refuses any key outside the caller's
 * org namespace, so cross-tenant access is impossible. Instructors may only read
 * keys under their own instructor prefix.
 */
export async function GET(req: Request) {
  const { ctx, repos } = await requireTenant();
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  if (ctx.role !== "admin") {
    const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
    // Instructors may only read keys under their own org+instructor prefix.
    if (!me || !key.startsWith(`org_${ctx.organisationId}/instructor_${me.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const object = await getDocument(ctx, key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the document types we accept are shown inline; anything else (old
  // uploads from before type sniffing) is forced to download, never rendered.
  const type = object.httpMetadata?.contentType ?? "application/octet-stream";
  const inline = ALLOWED_DOCUMENT_TYPES.has(type);
  const leaf = key.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "document";
  return new Response(object.body, {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${leaf}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
