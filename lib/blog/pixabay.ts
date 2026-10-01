/**
 * Minimal Pixabay API client. Pixabay issues API keys instantly (free), its
 * licence requires self-hosting (download + cache, don't hotlink) which is ideal
 * for SEO, and it requires no attribution. We still store a credit for goodwill.
 *
 * Makes an outbound fetch — works in the deployed Worker, not the build sandbox.
 */

export interface PixabayHit {
  id: number;
  pageURL: string;
  largeImageURL: string;
  webformatURL: string;
  user: string;
  tags: string;
}

interface PixabayResponse {
  hits?: PixabayHit[];
}

export async function searchPixabay(apiKey: string, query: string, perPage = 10): Promise<PixabayHit[]> {
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(Math.max(3, perPage)));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Pixabay search failed: ${res.status}`);
  const data = (await res.json()) as PixabayResponse;
  return data.hits ?? [];
}
