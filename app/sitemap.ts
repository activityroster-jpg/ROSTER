import type { MetadataRoute } from "next";
import { apexDomain } from "@/lib/config";
import { COMPETITORS } from "@/lib/marketing/competitors";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = `https://${apexDomain()}`;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/demo`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site}/book`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/data-processing`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const competitorRoutes: MetadataRoute.Sitemap = COMPETITORS.map((c) => ({
    url: `${site}/compare/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Blog posts (published & live). Best-effort — never fail the sitemap.
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const repo = new PlatformRepository(await getDb());
    const posts = await repo.listPublishedPosts(1000, 0);
    blogRoutes = posts.map((p) => ({
      url: `${site}/blog/${p.slug}`,
      lastModified: p.updatedAt instanceof Date ? p.updatedAt : new Date(Number(p.updatedAt ?? Date.now())),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // table may not exist yet / no binding at build — omit blog URLs
  }

  return [...staticRoutes, ...competitorRoutes, ...blogRoutes];
}
