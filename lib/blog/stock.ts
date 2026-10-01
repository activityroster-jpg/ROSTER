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

const pick = <T>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);

/**
 * Find a cover candidate for a query, trying Pixabay first, then Pexels. Picks a
 * RANDOM match from the top results so re-fetching swaps to a different photo, and
 * avoids any whose creditUrl is in `exclude` (photos already used on other
 * articles) so the blog doesn't repeat the same image everywhere.
 */
export async function findCover(env: CloudflareEnv, query: string, exclude?: Set<string>): Promise<StockCandidate | null> {
  const choose = (cands: StockCandidate[]): StockCandidate | undefined => {
    const fresh = exclude ? cands.filter((c) => !exclude.has(c.creditUrl)) : cands;
    return pick(fresh.length ? fresh : cands);
  };

  if (env.PIXABAY_API_KEY) {
    const hits = await searchPixabay(env.PIXABAY_API_KEY, query, 30);
    const chosen = choose(hits.map((h) => ({ downloadUrl: h.largeImageURL, credit: h.user, creditUrl: h.pageURL })));
    if (chosen) return chosen;
  }
  if (env.PEXELS_API_KEY) {
    const photos = await searchPexels(env.PEXELS_API_KEY, query, 30);
    const chosen = choose(photos.map((p) => ({ downloadUrl: p.src.large2x || p.src.large || p.src.original, credit: p.photographer, creditUrl: p.url })));
    if (chosen) return chosen;
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
