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
 * Build an ON-TOPIC search query for an article. We deliberately do NOT feed the
 * article's tags into the image search — tags like "first aid", "GDPR" or
 * "safeguarding" return wildly off-theme stock (surgery photos, padlocks, etc.).
 * Instead we map the category to a set of reliably marine queries and pick one by
 * a hash of the title, so covers stay varied but always sailing/watersports.
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

export function queryForArticle(a: { title: string; category: string; tags: string }): string {
  const hint = MARINE_BY_CATEGORY.find((h) => h.match.test(a.category));
  const pool = hint ? hint.queries : GENERAL_MARINE;
  return pool[hashStr(a.title) % pool.length]!;
}
