import { NextResponse } from "next/server";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { leadSchema } from "@/lib/validation/lead";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Public email capture from the marketing site. Rate-limited, Zod-validated,
 * deduped on email. Optionally notifies the team inbox (best-effort).
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`lead:${clientIp(req)}`, 15, 60);
  if (!limit.allowed) return tooManyRequests();

  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  }
  const { email, centreName, orgType, message, source } = parsed.data;

  const { control } = await getRepositories();
  await control.captureLead({
    email,
    centreName: centreName || null,
    orgType,
    message: message || null,
    source: source || "marketing",
  });

  // Best-effort internal notification — never fails the request.
  try {
    const env = getEnv();
    await sendEmail({
      to: `hello@${env.APP_APEX_DOMAIN}`,
      subject: `New demo request: ${centreName || email}`,
      html: `<p>${email}${centreName ? ` — ${centreName}` : ""}${orgType ? ` (${orgType})` : ""}</p>${message ? `<p>${message}</p>` : ""}`,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true });
}
