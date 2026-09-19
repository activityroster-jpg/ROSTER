/**
 * Small config helpers safe to call from any context (server, client, static).
 * The apex domain is exposed as a build-time public var so it can be used in
 * both the marketing UI and links without needing the runtime binding.
 */
export const DEFAULT_APEX = "activityroster.com";

export function apexDomain(): string {
  return process.env.NEXT_PUBLIC_APEX_DOMAIN || DEFAULT_APEX;
}
