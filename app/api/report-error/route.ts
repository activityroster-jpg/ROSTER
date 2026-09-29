import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException, scrub } from "@/lib/observability/sentry";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { getAuth } from "@/lib/auth";
import { resolveHost } from "@/lib/tenant/host";
import { platformAdminEmails } from "@/lib/platform/admin";
import { sendEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().max(2000),
  digest: z.string().max(200).optional(),
  path: z.string().max(500).optional(),
});

/**
 * Client error sink. Logs to Sentry (PII-scrubbed), persists a triage-able
 * report bucketed by centre, and emails the platform owner. Best-effort: any
 * sub-step failing never fails the request. Rate-limited against abuse.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`report-error:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { message, digest, path } = parsed.data;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  await captureException(new Error(scrub(message)), {
    tags: { area: "client" },
    extra: digest ? { digest } : undefined,
  });

  // Attribute to a user + centre (best-effort) and persist.
  try {
    const env = getEnv();
    const { control } = await getRepositories();
    const host = resolveHost(req.headers.get("host"), env.APP_APEX_DOMAIN);
    const slug = host.kind === "tenant" ? host.slug : null;
    const org = slug ? await control.organisationBySlug(slug) : null;

    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const session = await (await getAuth()).api.getSession({ headers: new Headers(req.headers) });
      userId = session?.user?.id ?? null;
      userEmail = session?.user?.email ?? null;
    } catch { /* not signed in */ }

    await control.createErrorReport({
      organisationId: org?.id ?? null,
      organisationSlug: slug,
      userId,
      userEmail,
      path: path ?? null,
      message,
      digest: digest ?? null,
      userAgent,
    });

    // Notify the platform owner(s).
    const admins = [...platformAdminEmails()];
    if (admins.length) {
      const body = `
        <p><strong>New error reported on ActivityRoster</strong></p>
        <p><strong>Centre:</strong> ${org?.name ?? "—"} (${slug ?? "no subdomain"})<br>
        <strong>User:</strong> ${userEmail ?? "not signed in"}<br>
        <strong>Page:</strong> ${path ?? "—"}<br>
        <strong>When:</strong> ${new Date().toISOString()}</p>
        <p><strong>Message:</strong><br>${scrub(message)}</p>
        ${digest ? `<p><strong>Digest:</strong> ${digest}</p>` : ""}
        <p style="color:#64748b;font-size:12px">See all reports at /admin/errors.</p>`;
      await Promise.all(admins.map((to) => sendEmail({ to, subject: `⚠️ Error reported — ${org?.name ?? "ActivityRoster"}`, html: body }).catch(() => {})));
    }
  } catch (err) {
    console.error("[report-error] persist/notify failed:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
