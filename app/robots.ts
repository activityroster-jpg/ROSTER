import type { MetadataRoute } from "next";
import { apexDomain } from "@/lib/config";
import { getEnv } from "@/lib/cf/bindings";

export default function robots(): MetadataRoute.Robots {
  const site = `https://${apexDomain()}`;
  // Staging mirrors production: keep it out of search entirely.
  let staging = false;
  try { staging = getEnv().APP_ENV === "staging"; } catch { /* no bindings (build time): treat as production */ }
  if (staging) return { rules: [{ userAgent: "*", disallow: "/" }], host: site };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep the authenticated app + admin + APIs out of the index.
        disallow: ["/office", "/portal", "/admin", "/dev", "/api/", "/sign-in", "/pin", "/set-pin", "/no-access", "/suspended"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
