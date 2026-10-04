import { getAuth } from "@/lib/auth";
import { authThrottleRule, emailFromBody } from "@/lib/security/auth-throttle";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { getEnv } from "@/lib/cf/bindings";
import { turnstileEnabled, verifyTurnstile } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

/**
 * Better Auth catch-all handler (sign-in, sign-up, magic link, 2FA, session).
 * The instance is built per request because D1 is a request-scoped binding.
 *
 * Sensitive POSTs (sign-in, magic link, password reset, 2FA codes…) are
 * throttled per IP and per email with the KV limiter, failing CLOSED: Better
 * Auth's built-in limiter is in-memory and does not hold across Workers
 * isolates.
 */
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rule = authThrottleRule(req.method, url.pathname);
  if (rule) {
    const ip = clientIp(req);
    const byIp = await rateLimit(`auth:${rule.key}:ip:${ip}`, rule.perIp, rule.windowSeconds, { failClosed: true });
    if (!byIp.allowed) return tooManyRequests();

    if (rule.perEmail) {
      // Peek at the body for the target email without consuming the request.
      let email: string | null = null;
      try { email = emailFromBody(await req.clone().json()); } catch { email = null; }
      if (email) {
        const byEmail = await rateLimit(`auth:${rule.key}:email:${email}`, rule.perEmail, rule.windowSeconds, { failClosed: true });
        if (!byEmail.allowed) return tooManyRequests();
      }
    }
  }

  // After a few failed sign-ins from one address, require the Turnstile human
  // check as well (spec: "show Turnstile after repeated failures"). The client
  // sees 428 and renders the widget, then retries with the token in a header.
  const isCredentialPost = req.method === "POST" && /\/sign-in\/(email|username)$/.test(url.pathname);
  const ip = clientIp(req);
  // Failures are counted per account (decision 10): a shared centre Wi-Fi never
  // pushes everyone else into the human check. No email in the body → the address.
  let failEmail: string | null = null;
  if (isCredentialPost) { try { failEmail = emailFromBody(await req.clone().json()); } catch { failEmail = null; } }
  const failKey = failEmail ? `auth:fails:email:${failEmail}` : `auth:fails:${ip}`;
  if (isCredentialPost && turnstileEnabled()) {
    let fails = 0;
    try { fails = Number((await getEnv().TENANT_CACHE.get(failKey)) ?? "0"); } catch { fails = 0; }
    if (fails >= FAILS_BEFORE_CHALLENGE) {
      const human = await verifyTurnstile(req.headers.get("x-turnstile-token"), ip);
      if (!human.ok) return Response.json({ code: "TURNSTILE_REQUIRED", message: human.reason }, { status: 428 });
    }
  }

  const auth = await getAuth();
  const res = await auth.handler(req);
  if (isCredentialPost) {
    try {
      const kv = getEnv().TENANT_CACHE;
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        const n = Number((await kv.get(failKey)) ?? "0") + 1;
        await kv.put(failKey, String(n), { expirationTtl: 15 * 60 });
      } else if (res.ok) {
        await kv.delete(failKey);
      }
    } catch { /* counting is best-effort */ }
  }
  return res;
}

const FAILS_BEFORE_CHALLENGE = 3;

export { handler as GET, handler as POST };
