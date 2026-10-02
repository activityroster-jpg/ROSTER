import { NextResponse, type NextRequest } from "next/server";
import { resolveHost } from "@/lib/tenant/host";
import { PIN_COOKIE, PIN_IDLE_MAX_AGE_S } from "@/lib/auth/pin";

/**
 * Slide the "PIN verified" cookie forward on each authenticated app request, so
 * it expires only after a stretch of inactivity (idle timeout). Re-sets the same
 * signed value with a fresh 30-minute Max-Age; no re-signing needed.
 */
function slidePinCookie(req: NextRequest, res: NextResponse): NextResponse {
  const pin = req.cookies.get(PIN_COOKIE)?.value;
  if (pin) {
    res.cookies.set(PIN_COOKIE, pin, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: PIN_IDLE_MAX_AGE_S,
    });
  }
  return res;
}

/**
 * Host-based routing only. The subdomain decides which surface is reachable:
 *   - apex / www        → marketing site (app routes are blocked)
 *   - {slug}.apex       → the centre app (marketing is redirected to the app)
 *
 * This is NOT authorisation — it never reads the database or a session. Every
 * app route re-resolves the org and checks membership server-side
 * (lib/tenant/resolve). The subdomain is a hint; membership is the gate.
 */
const APEX = process.env.NEXT_PUBLIC_APEX_DOMAIN || "activityroster.com";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const host = resolveHost(req.headers.get("host"), APEX);

  const isAppPath = path.startsWith("/office") || path.startsWith("/portal");

  if (host.kind === "tenant") {
    // The platform admin area is apex-only; bounce it off centre subdomains.
    if (path.startsWith("/admin")) {
      const to = url.clone();
      to.pathname = "/admin";
      to.host = APEX;
      return NextResponse.redirect(to);
    }
    // On a centre subdomain, send the root to the office app.
    if (path === "/") {
      const to = url.clone();
      to.pathname = "/office";
      return NextResponse.redirect(to);
    }
    // Keep the PIN session alive while the admin/instructor is active.
    return isAppPath ? slidePinCookie(req, NextResponse.next()) : NextResponse.next();
  }

  // Apex / reserved / unknown: the app surfaces are not served here.
  if (isAppPath) {
    const to = url.clone();
    to.pathname = "/";
    to.host = APEX;
    return NextResponse.redirect(to);
  }

  // The platform admin area lives on the apex — slide its PIN session too.
  return path.startsWith("/admin") ? slidePinCookie(req, NextResponse.next()) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
