import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require";
import { attachDocument, type DocumentKind } from "@/lib/services/documents";
import { instructor as instructorTable } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

/**
 * Upload a certificate/vetting document and attach it to a compliance item or
 * qualification. Admins may upload against any record; instructors only their
 * own (enforced by resolving their instructor id from the session).
 */
export async function POST(req: Request) {
  const { ctx, repos } = await requireTenant();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

  const kind = String(form.get("kind") ?? "");
  const itemId = String(form.get("itemId") ?? "");
  const file = form.get("file");

  if (kind !== "compliance" && kind !== "qualification") {
    return NextResponse.json({ error: "Invalid document kind" }, { status: 400 });
  }
  if (!itemId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing item or file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type (PDF or image only)" }, { status: 415 });
  }

  // Instructors may only upload against their own records.
  let restrictTo: string | undefined;
  if (ctx.role !== "admin") {
    const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.userId, ctx.userId)))[0];
    if (!me) return NextResponse.json({ error: "No linked instructor profile" }, { status: 403 });
    restrictTo = me.id;
  }

  const result = await attachDocument(
    repos,
    ctx,
    { kind: kind as DocumentKind, itemId, filename: file.name, contentType: file.type, body: await file.arrayBuffer() },
    restrictTo,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, docKey: result.docKey });
}
