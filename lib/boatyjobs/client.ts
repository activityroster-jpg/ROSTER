import type { BoatyJobPayload } from "@/lib/domain/jobs";

/**
 * The Boaty Jobs partner API (boatyjobs.com, also run by ActiveRoster Ltd).
 * Server-side only: authenticated with BOATYJOBS_PARTNER_SECRET, which never
 * reaches the browser. Plain fetch, so it runs on Workers.
 *
 *   publish  POST  /api/partner/jobs                     (Idempotency-Key header)
 *   update   PATCH /api/partner/jobs/{external_id}
 *   close    POST  /api/partner/jobs/{external_id}/close
 */
export const DEFAULT_BOATYJOBS_BASE = "https://boatyjobs.com";

export interface PartnerConfig {
  secret: string | undefined;
  /** Override for testing against a Boaty Jobs staging site. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ListingInfo {
  listingId: string | null;
  publicUrl: string | null;
  expiresAt: Date | null;
}

export type PartnerResult =
  | ({ ok: true } & ListingInfo)
  /** retry: worth trying again later (network, 5xx, 429, not configured). */
  | { ok: false; retry: boolean; error: string };

function info(body: unknown): ListingInfo {
  const b = (body ?? {}) as { listing_id?: unknown; public_url?: unknown; expires_at?: unknown };
  const expires = typeof b.expires_at === "string" || typeof b.expires_at === "number" ? new Date(b.expires_at) : null;
  return {
    listingId: typeof b.listing_id === "string" ? b.listing_id : null,
    publicUrl: typeof b.public_url === "string" && /^https:\/\//.test(b.public_url) ? b.public_url : null,
    expiresAt: expires && !Number.isNaN(expires.getTime()) ? expires : null,
  };
}

async function call(cfg: PartnerConfig, method: "POST" | "PATCH", path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<PartnerResult> {
  if (!cfg.secret) return { ok: false, retry: true, error: "Boaty Jobs isn't connected yet (no partner secret set)." };
  const f = cfg.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(`${cfg.baseUrl ?? DEFAULT_BOATYJOBS_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${cfg.secret}`, "Content-Type": "application/json", Accept: "application/json", ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, retry: true, error: `Couldn't reach Boaty Jobs (${e instanceof Error ? e.message : "network error"}).` };
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* empty or not JSON */ }
  if (res.ok) return { ok: true, ...info(json) };
  const message = typeof (json as { error?: unknown } | null)?.error === "string" ? (json as { error: string }).error : `HTTP ${res.status}`;
  // 408 / 429 / 5xx: try again later. Other 4xx: the listing itself was refused; retrying won't help.
  const retry = res.status === 408 || res.status === 429 || res.status >= 500;
  return { ok: false, retry, error: `Boaty Jobs said: ${message.slice(0, 300)}` };
}

export function publishJob(cfg: PartnerConfig, payload: BoatyJobPayload, idempotencyKey: string): Promise<PartnerResult> {
  return call(cfg, "POST", "/api/partner/jobs", payload, { "Idempotency-Key": idempotencyKey });
}

export function updateJob(cfg: PartnerConfig, payload: BoatyJobPayload): Promise<PartnerResult> {
  return call(cfg, "PATCH", `/api/partner/jobs/${encodeURIComponent(payload.external_id)}`, payload);
}

export function closeJob(cfg: PartnerConfig, externalId: string): Promise<PartnerResult> {
  return call(cfg, "POST", `/api/partner/jobs/${encodeURIComponent(externalId)}/close`, {});
}
