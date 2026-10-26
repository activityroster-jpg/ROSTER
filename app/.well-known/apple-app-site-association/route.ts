import { getEnv } from "@/lib/cf/bindings";
import { APP_LINK_PATHS } from "@/lib/mobile/links";

export const dynamic = "force-dynamic";

/**
 * iOS universal links. Apple fetches this (no extension, JSON body) and lets
 * the ActivityRoster app open our sign-in / magic links directly. Served only
 * once APPLE_TEAM_ID and IOS_BUNDLE_ID are set — see mobile/README.md.
 */
export async function GET() {
  const env = getEnv();
  if (!env.APPLE_TEAM_ID || !env.IOS_BUNDLE_ID) return new Response("Not configured", { status: 404 });
  const appID = `${env.APPLE_TEAM_ID}.${env.IOS_BUNDLE_ID}`;
  const body = {
    applinks: {
      details: [{ appIDs: [appID], components: APP_LINK_PATHS.map((p) => ({ "/": p })) }],
    },
    webcredentials: { apps: [appID] },
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
}
