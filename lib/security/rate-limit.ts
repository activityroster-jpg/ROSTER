import { getDb, getEnv } from "@/lib/cf/bindings";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";

/**
 * Fixed-window rate limiting. Auth-sensitive limits (`failClosed`) are counted
 * in D1 with one atomic statement, so parallel guesses cannot slip past the
 * limit the way they could with KV's read-then-write (audit C7). Everything
 * else (webhooks, public forms) stays on the cheaper KV counter, which fails
 * OPEN on a cache blip so the site never goes down for it.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  opts?: { failClosed?: boolean },
): Promise<RateLimitResult> {
  if (opts?.failClosed) return durableRateLimit(key, limit, windowSeconds);
  try {
    const kv = getEnv().TENANT_CACHE;
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const bucket = `rl:${key}:${window}`;
    const current = Number((await kv.get(bucket)) ?? "0");
    if (current >= limit) return { allowed: false, remaining: 0 };
    await kv.put(bucket, String(current + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - current - 1 };
  } catch (err) {
    // Auth-sensitive limits fail CLOSED: a KV blip must not switch off brute-force protection.
    console.warn(`[rate-limit] KV unavailable, failing ${opts?.failClosed ? "closed" : "open"}:`, (err as Error).message);
    return opts?.failClosed ? { allowed: false, remaining: 0 } : { allowed: true, remaining: limit };
  }
}

/** The durable counter (D1). Fails CLOSED: if the count can't be recorded, the attempt is refused. */
export async function durableRateLimit(key: string, limit: number, windowSeconds: number, now: number = Date.now(), repo?: ControlPlaneRepository): Promise<RateLimitResult> {
  try {
    const control = repo ?? new ControlPlaneRepository(await getDb());
    const window = Math.floor(now / 1000 / windowSeconds);
    const count = await control.hitRateLimit(key.slice(0, 300), window, new Date((window + 1) * windowSeconds * 1000));
    return count > limit ? { allowed: false, remaining: 0 } : { allowed: true, remaining: limit - count };
  } catch (err) {
    console.warn("[rate-limit] durable counter unavailable, failing closed:", (err as Error).message);
    return { allowed: false, remaining: 0 };
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
