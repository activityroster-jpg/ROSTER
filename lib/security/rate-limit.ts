import { getEnv } from "@/lib/cf/bindings";

/**
 * A small fixed-window rate limiter backed by Workers KV. Used on auth, signup
 * and webhook endpoints (brief §8). Fails OPEN on a KV error so a cache blip
 * never takes the site down — the trade-off is logged.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const kv = getEnv().TENANT_CACHE;
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const bucket = `rl:${key}:${window}`;
    const current = Number((await kv.get(bucket)) ?? "0");
    if (current >= limit) return { allowed: false, remaining: 0 };
    await kv.put(bucket, String(current + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - current - 1 };
  } catch (err) {
    console.warn("[rate-limit] KV unavailable, failing open:", (err as Error).message);
    return { allowed: true, remaining: limit };
  }
}

/** Best-effort client IP for keying limits. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "60" },
  });
}
