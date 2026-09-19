import { isReservedSubdomain } from "./reserved";

/**
 * Extract the centre slug from a request host.
 *
 * `apex` is the root domain the platform runs on (e.g. "activityroster.com").
 * Returns:
 *  - { kind: "apex" }       → marketing site / signup
 *  - { kind: "tenant", slug } → a centre's app
 *  - { kind: "reserved" }   → a reserved subdomain (www, api, …) → marketing/system
 *  - { kind: "unknown" }    → not on our apex (custom domain, localhost fallback)
 *
 * The slug returned here is only a HINT. Authorisation always re-resolves the
 * org and checks membership server-side; never trust the host alone.
 */
export type HostResolution =
  | { kind: "apex" }
  | { kind: "reserved"; label: string }
  | { kind: "tenant"; slug: string }
  | { kind: "unknown"; host: string };

export function resolveHost(rawHost: string | null | undefined, apex: string): HostResolution {
  if (!rawHost) return { kind: "unknown", host: "" };

  // Strip port and lowercase.
  const host = rawHost.split(":")[0]!.trim().toLowerCase();
  const apexHost = apex.split(":")[0]!.trim().toLowerCase();

  if (host === apexHost || host === `www.${apexHost}`) {
    return host === `www.${apexHost}` ? { kind: "reserved", label: "www" } : { kind: "apex" };
  }

  const suffix = `.${apexHost}`;
  if (!host.endsWith(suffix)) {
    return { kind: "unknown", host };
  }

  const label = host.slice(0, -suffix.length);
  // Only a single-level label is a tenant; anything with a dot is unknown.
  if (label.length === 0 || label.includes(".")) {
    return { kind: "unknown", host };
  }

  if (isReservedSubdomain(label)) {
    return { kind: "reserved", label };
  }

  return { kind: "tenant", slug: label };
}
