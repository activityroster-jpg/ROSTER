import { NextResponse, type NextRequest } from "next/server";
import { resolveHost } from "@/lib/tenant/host";
import { PIN_COOKIE, PIN_IDLE_MAX_AGE_S } from "@/lib/auth/pin";
import { LV_COOKIE, LV_DEVICE_COOKIE, LV_IDLE_MAX_AGE_S, LV_SESSION_COOKIE } from "@/lib/auth/login-verify";
import { DEVICE_COOKIE, DEVICE_HEADER, DEVICE_MAX_AGE_S, PATH_HEADER, isDeviceId } from "@/lib/auth/device";
import { CENTRE_COOKIE } from "@/lib/auth/centre-cookie";
import { isNonceCspPath, makeNonce, noncePolicy } from "@/lib/security/csp";

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
  // Same idea for the office's "login verified" proof: 12 hours of inactivity
  // ends it. The browser-session twin (set for "just this once") is re-set
  // without a Max-Age so it still vanishes when the browser closes.
  const lv = req.cookies.get(LV_COOKIE)?.value;
  if (lv) {
    res.cookies.set(LV_COOKIE, lv, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: LV_IDLE_MAX_AGE_S });
    const lvs = req.cookies.get(LV_SESSION_COOKIE)?.value;
    if (lvs) res.cookies.set(LV_SESSION_COOKIE, lvs, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    const lvd = req.cookies.get(LV_DEVICE_COOKIE)?.value;
    if (lvd) res.cookies.set(LV_DEVICE_COOKIE, lvd, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: LV_IDLE_MAX_AGE_S });
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

  // Device identity for the unfamiliar-device check: a random id in a
  // long-lived cookie, also forwarded as a request header so this very request
  // can see it (a client-sent header is always overwritten here, never trusted).
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existing && isDeviceId(existing) ? existing : crypto.randomUUID();
  const fwd = new Headers(req.headers);
  fwd.set(DEVICE_HEADER, deviceId);
  fwd.set(PATH_HEADER, path);
  // Nonce CSP for the signed-in surfaces, report-only for now (lib/security/csp).
  // The request header lets Next stamp the nonce on its own inline scripts; the
  // response header has the browser evaluate the policy and report violations.
  const cspReportOnly = isNonceCspPath(path) ? noncePolicy(makeNonce()) : null;
  if (cspReportOnly) fwd.set("content-security-policy-report-only", cspReportOnly);
  const next = () => {
    const res = NextResponse.next({ request: { headers: fwd } });
    if (cspReportOnly) res.headers.set("Content-Security-Policy-Report-Only", cspReportOnly);
    if (deviceId !== existing) {
      res.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${APEX}`, maxAge: DEVICE_MAX_AGE_S });
    }
    return res;
  };

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
    return isAppPath ? slidePinCookie(req, next()) : next();
  }

  // Apex / reserved / unknown: the office is never served here. The instructor
  // portal IS, for the mobile app, once a centre has been selected (signed
  // cookie; membership is still checked server-side on every request).
  const mobilePortal = host.kind === "apex" && path.startsWith("/portal") && req.cookies.has(CENTRE_COOKIE);
  if (isAppPath && !mobilePortal) {
    const to = url.clone();
    to.pathname = path.startsWith("/portal") ? "/app" : "/";
    to.host = APEX;
    return NextResponse.redirect(to);
  }
  if (mobilePortal) return slidePinCookie(req, next());

  // The platform admin area lives on the apex — slide its PIN session too.
  return path.startsWith("/admin") ? slidePinCookie(req, next()) : next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
