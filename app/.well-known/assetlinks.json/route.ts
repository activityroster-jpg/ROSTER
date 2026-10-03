import { getEnv } from "@/lib/cf/bindings";

export const dynamic = "force-dynamic";

/**
 * Android app links. Google verifies this against the signing certificate so
 * links to our domain open in the ActivityRoster app. Served only once
 * ANDROID_PACKAGE and ANDROID_SHA256_FINGERPRINTS are set — see mobile/README.md.
 */
export async function GET() {
  const env = getEnv();
  const prints = (env.ANDROID_SHA256_FINGERPRINTS ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!env.ANDROID_PACKAGE || prints.length === 0) return new Response("Not configured", { status: 404 });
  const body = [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: env.ANDROID_PACKAGE, sha256_cert_fingerprints: prints },
  }];
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
}
