/**
 * Minimal Pexels API client for sourcing blog cover images.
 *
 * Why Pexels: free API, the licence permits downloading and self-hosting (which
 * is best for SEO — images are served from our own domain), and attribution is a
 * light touch (a credit link, which we store and show). We download the chosen
 * photo and store it in R2 rather than hotlinking.
 *
 * Note: this makes an outbound fetch, which works in the deployed Cloudflare
 * Worker but not in the restricted build sandbox.
 */

import { SEED_ARTICLES } from "./seed";

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string; // the Pexels page (used for credit link)
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    landscape: string;
  };
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
}

/** Search Pexels for landscape photos matching a query. Throws if no key/HTTP error. */
export async function searchPexels(apiKey: string, query: string, perPage = 10): Promise<PexelsPhoto[]> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", String(perPage));
  const res = await fetch(url.toString(), { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);
  const data = (await res.json()) as PexelsSearchResponse;
  return data.photos ?? [];
}

/** Download a photo (prefer the ~1880px large2x) as an ArrayBuffer for storage in R2. */
export async function downloadPexelsImage(photo: PexelsPhoto): Promise<{ body: ArrayBuffer; contentType: string }> {
  const src = photo.src.large2x || photo.src.large || photo.src.original;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { body: await res.arrayBuffer(), contentType };
}

/**
 * Build an ON-TOPIC search query for an article.
 *
 * Starter articles carry their own `imageQuery` (lib/blog/seed) describing what
 * the photo should show — a dinghy for a dinghy article, a yacht for yachting,
 * an office desk for admin, an instructor teaching for staff pieces — so that is
 * used whenever the post is one of ours (matched by slug).
 *
 * For posts written by hand we deliberately do NOT feed the article's tags into
 * the image search — tags like "first aid", "GDPR" or "safeguarding" return
 * wildly off-theme stock (surgery photos, padlocks, etc.). Instead the category
 * maps to a set of reliably marine queries and one is picked by a hash of the
 * title, so covers stay varied but always sailing/watersports.
 */
const MARINE_BY_CATEGORY: { match: RegExp; queries: string[] }[] = [
  { match: /instructor|staff|team|coach/i, queries: ["sailing instructor", "sailing coach", "dinghy sailing lesson", "sailing crew"] },
  { match: /complian|safe|risk/i, queries: ["sailing safety boat", "rib safety boat sea", "dinghy sailing", "sailboat sea"] },
  { match: /course|teach|learn|junior|youth/i, queries: ["learn to sail dinghy", "youth sailing", "sailing lesson", "dinghy sailing"] },
  { match: /market|grow|sales|member/i, queries: ["marina yachts", "sailing boats harbour", "yacht marina", "sailboats sea"] },
  { match: /operation|digital|admin|running|starting/i, queries: ["sailing club marina", "harbour sailing boats", "yacht marina", "sailing dinghies"] },
];
const GENERAL_MARINE = ["sailing dinghy", "sailboat sea", "yacht sailing", "sailing boat", "sailing regatta", "watersports sailing"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

let seedQueries: Map<string, string> | null = null;
function seedQueryFor(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  if (!seedQueries) seedQueries = new Map(SEED_ARTICLES.map((a) => [a.slug, a.imageQuery]));
  return seedQueries.get(slug);
}

export function queryForArticle(a: { slug?: string; title: string; category: string; tags: string }): string {
  const own = seedQueryFor(a.slug);
  if (own) return own;
  const hint = MARINE_BY_CATEGORY.find((h) => h.match.test(a.category));
  const pool = hint ? hint.queries : GENERAL_MARINE;
  return pool[hashStr(a.title) % pool.length]!;
}

/**
 * Short fingerprint of the query a cover was fetched with. It is embedded in
 * the R2 key, so when an article's query changes (the photo should now show
 * something else) the existing cover counts as stale and "Refresh covers"
 * replaces it, without touching covers that already match.
 */
export function queryFingerprint(query: string): string {
  return hashStr(query.trim().toLowerCase()).toString(36).padStart(6, "0").slice(-6);
}
