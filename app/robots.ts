import type { MetadataRoute } from "next";
import { apexDomain } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const site = `https://${apexDomain()}`;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep the authenticated app + admin + APIs out of the index.
        disallow: ["/office", "/portal", "/admin", "/api/", "/sign-in", "/pin", "/set-pin", "/no-access", "/suspended"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
