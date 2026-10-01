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
 * Build a watersports-biased search query from an article so results stay on
 * theme (Pexels has lots of generic imagery). Uses the first tag or the category,
 * nudged toward sailing/watersports.
 */
export function queryForArticle(a: { title: string; category: string; tags: string }): string {
  const firstTag = a.tags.split(",").map((t) => t.trim()).filter(Boolean)[0];
  const seed = (firstTag || a.category || "sailing").toLowerCase();
  // Keep it on the water unless the seed already implies it.
  const marine = /sail|boat|yacht|water|marina|dinghy|kayak|paddle|wind|surf|rya/.test(seed);
  return marine ? `${seed} sailing` : `${seed} sailing watersports`;
}
