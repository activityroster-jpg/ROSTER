import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require";
import { sniffDocumentType } from "@/lib/security/file-type";
import { featureRequestSchema, FEATURE_REQUEST_MAX_SCREENSHOT_BYTES } from "@/lib/validation/feature-request";
import { FeatureRequestLimitError, submitFeatureRequest } from "@/lib/services/feature-requests";

export const dynamic = "force-dynamic";

const FIELDS = ["kind", "title", "problem", "change", "whoAffected", "frequency", "workaround", "importance", "details", "consentPublic"] as const;

/**
 * A centre sends a feature request or problem report (Settings → Requests).
 * Multipart, because of the optional screenshot. The organisation comes from
 * the TenantContext, never from the form; the screenshot's type is read from
 * its bytes and only PNG, JPEG or WebP is kept.
 */
export async function POST(req: Request) {
  const { ctx, organisation, repos } = await requireTenant({ permission: "office.view", allowReadOnly: true });
  if (ctx.ghost) return NextResponse.json({ error: "Ghost Mode is read-only." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected a form" }, { status: 400 });

  const parsed = featureRequestSchema.safeParse(Object.fromEntries(FIELDS.map((k) => {
    const v = form.get(k);
    return [k, typeof v === "string" ? v : undefined];
  })));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return NextResponse.json({ error: "A few answers need a little more. They're marked below.", fieldErrors }, { status: 400 });
  }

  let screenshot: { body: ArrayBuffer; contentType: string } | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > FEATURE_REQUEST_MAX_SCREENSHOT_BYTES) return NextResponse.json({ error: "That screenshot is too big (5 MB at most).", fieldErrors: { screenshot: "5 MB at most" } }, { status: 413 });
    const body = await file.arrayBuffer();
    const type = sniffDocumentType(body);
    if (type !== "image/png" && type !== "image/jpeg" && type !== "image/webp") {
      return NextResponse.json({ error: "The screenshot must be a PNG, JPEG or WebP image.", fieldErrors: { screenshot: "PNG, JPEG or WebP only" } }, { status: 415 });
    }
    screenshot = { body, contentType: type };
  }

  const me = await repos.control.userById(ctx.userId).catch(() => null);
  try {
    const row = await submitFeatureRequest(repos, ctx, { organisation, answers: parsed.data, submitterName: me?.name ?? null, screenshot });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    if (e instanceof FeatureRequestLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }
}
