/**
 * Cover images for blog articles. We serve the site's own licensed photos from
 * /public/photos (reliable, EU-hosted, GDPR-aligned) rather than hotlinking a
 * third party. Pick is category-aware for topical relevance, with a slug hash so
 * articles in the same category still vary.
 *
 * (The blog Markdown renderer also supports ![alt](url) images, so individual
 * articles can embed additional imagery — local or hotlinked — inline.)
 */

const POOL = [
  "/photos/keelboat.jpg",
  "/photos/catamarans.jpg",
  "/photos/kayaks.jpg",
  "/photos/instructors.jpg",
  "/photos/deck.jpg",
  "/photos/marina.jpg",
  "/photos/sailing-hero.jpg",
] as const;

// Bias certain categories toward the most on-topic photos; fall back to the full pool.
const CATEGORY_HINTS: { match: RegExp; photos: string[] }[] = [
  { match: /instructor|staff|team|coach/i, photos: ["/photos/instructors.jpg", "/photos/deck.jpg"] },
  { match: /complian|safe|risk/i, photos: ["/photos/deck.jpg", "/photos/keelboat.jpg"] },
  { match: /course|teach|learn|junior|youth/i, photos: ["/photos/catamarans.jpg", "/photos/kayaks.jpg", "/photos/keelboat.jpg"] },
  { match: /market|grow|sales|member/i, photos: ["/photos/marina.jpg", "/photos/sailing-hero.jpg"] },
  { match: /operation|digital|admin|running|starting/i, photos: ["/photos/marina.jpg", "/photos/deck.jpg", "/photos/keelboat.jpg"] },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable cover image path for an article, biased by category. */
export function coverImageFor(slug: string, category?: string): string {
  const hint = category ? CATEGORY_HINTS.find((h) => h.match.test(category)) : undefined;
  const pool = hint ? hint.photos : (POOL as readonly string[]);
  return pool[hash(slug) % pool.length]!;
}
