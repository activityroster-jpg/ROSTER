import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require";
import { sniffDocumentType } from "@/lib/security/file-type";
import { rateLimit } from "@/lib/security/rate-limit";
import { ROSTER_EXAMPLE_MAX_BYTES, saveRosterExample } from "@/lib/services/roster-example";

export const dynamic = "force-dynamic";

/**
 * Upload an example of the roster the centre uses today (PDF or image). The
 * organisation comes from the TenantContext, never from the form; the file's
 * type is read from its bytes, never from the browser's claim.
 */
export async function POST(req: Request) {
  const { ctx, repos, organisation } = await requireTenant({ permission: "settings.edit" });
  if (ctx.ghost) return NextResponse.json({ error: "Ghost mode is read-only" }, { status: 403 });
  const limit = await rateLimit(`roster-example:${ctx.organisationId}`, 10, 60 * 60);
  if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Try again in an hour." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
  if (file.size > ROSTER_EXAMPLE_MAX_BYTES) return NextResponse.json({ error: "That file is too big (10 MB at most)." }, { status: 413 });
  const body = await file.arrayBuffer();
  const contentType = sniffDocumentType(body);
  if (!contentType) return NextResponse.json({ error: "Send a PDF or a photo (PNG, JPEG or WebP)." }, { status: 415 });

  const r = await saveRosterExample(repos, ctx, organisation, { filename: file.name, contentType, body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, example: r.example });
}
