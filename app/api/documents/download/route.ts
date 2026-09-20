import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireTenant } from "@/lib/tenant/require";
import { getDocument } from "@/lib/r2";
import { instructor as instructorTable } from "@/lib/db/schema";

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
    if (!me || !key.includes(`instructor_${me.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const object = await getDocument(ctx, key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
