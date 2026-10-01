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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchPixabay(apiKey: string, query: string, perPage = 10): Promise<PixabayHit[]> {
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", String(Math.max(3, perPage)));

  // Pixabay's free tier is rate-limited (~100 req/min). On a 429, back off once
  // and retry rather than failing the whole fetch.
  let res = await fetch(url.toString());
  if (res.status === 429) {
    await sleep(2000);
    res = await fetch(url.toString());
  }
  if (res.status === 429) throw new Error("rate-limited (429) — wait a minute and try again");
  if (!res.ok) throw new Error(`Pixabay search failed: ${res.status}`);
  const data = (await res.json()) as PixabayResponse;
  return data.hits ?? [];
}
