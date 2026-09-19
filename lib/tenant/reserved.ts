/**
 * Reserved subdomains that can never be claimed by a centre, plus slug
 * validation. Enforced at signup AND in the router — a slug that slips past one
 * must still be rejected by the other.
 */
export const RESERVED_SUBDOMAINS = new Set<string>([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "status",
  "assets",
  "static",
  "blog",
  "help",
  "docs",
  // extra safety: common infra / spoof-worthy names
  "auth",
  "login",
  "dashboard",
  "billing",
  "webhook",
  "webhooks",
  "cdn",
  "support",
]);

/** Slugs must be DNS-label-safe: lowercase a–z, 0–9, hyphens; 3–63 chars. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: "format" | "reserved" };

/**
 * Validate a desired slug. Normalises case before checking. Does NOT check
 * uniqueness (that requires a DB lookup) — see the organisation repository.
 */
export function validateSlug(input: string): SlugValidation {
  const slug = input.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return { ok: false, reason: "format" };
  if (RESERVED_SUBDOMAINS.has(slug)) return { ok: false, reason: "reserved" };
  return { ok: true, slug };
}

export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.trim().toLowerCase());
}
