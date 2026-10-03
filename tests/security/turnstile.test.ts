import { describe, expect, it } from "vitest";
import { verifyTurnstile } from "@/lib/security/turnstile";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const envWith = (secret?: string) => ({ TURNSTILE_SECRET_KEY: secret } as unknown as CloudflareEnv);
const fake = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

describe("turnstile", () => {
  it("skips when no secret is configured", async () => {
    expect(await verifyTurnstile("tok", "1.1.1.1", fake({ success: false }), envWith(undefined))).toEqual({ ok: true, skipped: true });
  });
  it("rejects a missing token once configured", async () => {
    const r = await verifyTurnstile(null, "1.1.1.1", fake({ success: true }), envWith("s"));
    expect(r.ok).toBe(false);
  });
  it("accepts a verified token and reports failures", async () => {
    expect(await verifyTurnstile("tok", "1.1.1.1", fake({ success: true }), envWith("s"))).toEqual({ ok: true, skipped: false });
    const bad = await verifyTurnstile("tok", null, fake({ success: false, "error-codes": ["timeout-or-duplicate"] }), envWith("s"));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/expired/);
  });
  it("fails open if Cloudflare cannot be reached", async () => {
    const down = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile("tok", null, down, envWith("s"))).toEqual({ ok: true, skipped: true });
  });
});
