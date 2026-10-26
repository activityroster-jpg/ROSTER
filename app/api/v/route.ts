import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getDb, getEnv, getRepositories } from "@/lib/cf/bindings";
import { authSecret } from "@/lib/security/secrets";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { resolveHost } from "@/lib/tenant/host";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { classify, deviceOf, isBot, referrerDomain } from "@/lib/analytics/channels";
import { visitorKey } from "@/lib/analytics/visitor";
import { TrafficRepository } from "@/lib/db/repositories/traffic";

export const dynamic = "force-dynamic";

const ok = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
const tag = z.string().trim().max(100).optional().nullable();
const Beacon = z.object({
  /** The page path, without the query string. */
  p: z.string().max(300).regex(/^\/[^\s?#]*$/),
  /** document.referrer on the first page of a load; empty after. */
  r: z.string().max(1000).optional().nullable(),
  us: tag, um: tag, uc: tag,
});

/** Paths that are never marketing pages, even on the apex. */
const NOT_MARKETING = /^\/(admin|office|portal|app|api|sign-in|two-factor|verify-login|pin|set-pin|welcome|security|reset-password|no-access|suspended|trial-ended|coming-soon)(\/|$)/;

/**
 * Page-view beacon for the public site (Dev Center → Growth → Traffic sources).
 * Cookieless: it sets nothing and reads no cookie except to skip a signed-in
 * platform admin or centre owner/admin. The IP and user agent are used only to
 * make the day-salted visitor key and the device type, then dropped. Always
 * answers 204, so it never shows an error on the site.
 */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    const host = resolveHost(req.headers.get("host"), env.APP_APEX_DOMAIN || "activityroster.com");
    if (host.kind !== "apex") return ok();
    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua)) return ok();
    const parsed = Beacon.safeParse(await req.json().catch(() => null));
    if (!parsed.success || NOT_MARKETING.test(parsed.data.p)) return ok();
    const ip = clientIp(req);
    const limit = await rateLimit(`pv:${ip}`, 120, 60);
    if (!limit.allowed) return ok();

    // Owners and admins looking at their own site don't count.
    if ((req.headers.get("cookie") ?? "").includes("session_token")) {
      const s = await (await getAuth()).api.getSession({ headers: req.headers }).catch(() => null);
      if (s?.user) {
        if (await isPlatformAdminEmail(s.user.email)) return ok();
        const ms = await (await getRepositories()).control.membershipsForUser(s.user.id);
        if (ms.some((m) => m.role === "owner" || m.role === "admin")) return ok();
      }
    }

    const { p, r, us, um, uc } = parsed.data;
    const apex = (env.APP_APEX_DOMAIN || "activityroster.com").toLowerCase();
    const ref = referrerDomain(r);
    // Our own site (or a centre's subdomain) is not a referrer.
    const external = ref && ref !== apex && !ref.endsWith(`.${apex}`) ? ref : null;
    const utmSource = us || null, utmMedium = um || null, utmCampaign = uc || null;
    await new TrafficRepository(await getDb()).record({
      path: p, referrerDomain: external, utmSource, utmMedium, utmCampaign, device: deviceOf(ua),
      channel: classify({ referrer: external, utmSource, utmMedium }),
    }, await visitorKey(authSecret(env), ip, ua));
  } catch { /* counting must never break the site */ }
  return ok();
}
