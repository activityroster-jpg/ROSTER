import { NextResponse, type NextRequest } from "next/server";
import { resolveHost } from "@/lib/tenant/host";

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
    // On a centre subdomain, send the root to the office app.
    if (path === "/") {
      const to = url.clone();
      to.pathname = "/office";
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  // Apex / reserved / unknown: the app surfaces are not served here.
  if (isAppPath) {
    const to = url.clone();
    to.pathname = "/";
    to.host = APEX;
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
