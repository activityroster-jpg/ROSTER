import { getAuth } from "@/lib/auth";
import { authThrottleRule, emailFromBody } from "@/lib/security/auth-throttle";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

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

  const auth = await getAuth();
  return auth.handler(req);
}

export { handler as GET, handler as POST };
