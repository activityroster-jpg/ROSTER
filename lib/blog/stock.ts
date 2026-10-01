/**
 * Provider-agnostic stock-photo sourcing for blog cover images. Uses whichever
 * free API key is configured — Pixabay (keys issued instantly) is preferred, with
 * Pexels as a fallback. Both licences permit downloading and self-hosting, which
 * is what we do (store in R2, serve from our own domain) for the best SEO.
 */

import type { CloudflareEnv } from "@/lib/cf/bindings";
import { searchPexels } from "./pexels";
import { searchPixabay } from "./pixabay";

export { queryForArticle } from "./pexels";

export interface StockCandidate {
  downloadUrl: string;
  credit: string;
  creditUrl: string;
}

/** True if any stock-photo provider is configured. */
export function hasStockKey(env: CloudflareEnv): boolean {
  return Boolean(env.PIXABAY_API_KEY || env.PEXELS_API_KEY);
}

/** Find a cover candidate for a query, trying Pixabay first, then Pexels. */
export async function findCover(env: CloudflareEnv, query: string): Promise<StockCandidate | null> {
  if (env.PIXABAY_API_KEY) {
    const hits = await searchPixabay(env.PIXABAY_API_KEY, query);
    const h = hits[0];
    if (h) return { downloadUrl: h.largeImageURL, credit: h.user, creditUrl: h.pageURL };
  }
  if (env.PEXELS_API_KEY) {
    const photos = await searchPexels(env.PEXELS_API_KEY, query);
    const p = photos[0];
    if (p) return { downloadUrl: p.src.large2x || p.src.large || p.src.original, credit: p.photographer, creditUrl: p.url };
  }
  return null;
}

/** Download an image URL as an ArrayBuffer for storage in R2. */
export async function downloadImage(url: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { body: await res.arrayBuffer(), contentType };
}
