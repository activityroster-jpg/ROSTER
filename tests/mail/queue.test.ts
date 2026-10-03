import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { backoffMinutes, drainEmailQueue, MAX_ATTEMPTS, queueAndSend, retryEmail } from "@/lib/mail/queue";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const RESEND = "https://api.resend.com/emails";
const env = { RESEND_API_KEY: "r" } as unknown as CloudflareEnv;
const msg = { from: "ActivityRoster <no-reply@activityroster.com>", to: "a@b.test", subject: "Hi", html: "<p>hi</p>", text: "hi" };
let mode: "ok" | "down" | "bad" = "ok";
const fakeFetch = (async (url: string) => {
  if (url !== RESEND) return new Response("?", { status: 404 });
  if (mode === "down") return new Response("busy", { status: 503 });
  if (mode === "bad") return new Response("domain not verified", { status: 403 });
  return new Response(JSON.stringify({ id: `re_${Math.random().toString(36).slice(2, 8)}` }));
}) as unknown as typeof fetch;

describe("email queue", () => {
  it("backs off 5, 15, 45, 135 minutes", () => {
    expect([1, 2, 3, 4].map(backoffMinutes)).toEqual([5, 15, 45, 135]);
  });

  it("sends at once and clears the body", async () => {
    const { db } = createTestDb(); const p = new PlatformRepository(db); mode = "ok";
    const r = await queueAndSend(db, env, msg, fakeFetch);
    expect(r.sent).toBe(true);
    const row = (await p.emailOutboxById(r.id))!;
    expect(row.status).toBe("sent"); expect(row.html).toBeNull(); expect(row.providerId).toMatch(/^re_/); expect(row.attempts).toBe(1);
  });

  it("retries a provider outage from the tick and gives up after five attempts", async () => {
    const { db } = createTestDb(); const p = new PlatformRepository(db); mode = "down";
    const r = await queueAndSend(db, env, msg, fakeFetch);
    expect(r.sent).toBe(false);
    let row = (await p.emailOutboxById(r.id))!;
    expect(row.status).toBe("queued"); expect(row.attempts).toBe(1); expect(row.html).not.toBeNull();
    expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);
    // Not due yet: the tick leaves it alone.
    expect((await drainEmailQueue(db, env, new Date(), 50, fakeFetch)).due).toBe(0);
    // Provider back: a later tick sends it.
    mode = "ok";
    const later = new Date(Date.now() + 10 * 60_000);
    expect(await drainEmailQueue(db, env, later, 50, fakeFetch)).toMatchObject({ due: 1, sent: 1 });
    row = (await p.emailOutboxById(r.id))!;
    expect(row.status).toBe("sent");
    // A message that never gets through ends up failed with its body cleared.
    mode = "down";
    const r2 = await queueAndSend(db, env, msg, fakeFetch);
    let t = Date.now();
    for (let i = 1; i < MAX_ATTEMPTS; i++) { t += backoffMinutes(i) * 60_000 + 1000; await drainEmailQueue(db, env, new Date(t), 50, fakeFetch); }
    const dead = (await p.emailOutboxById(r2.id))!;
    expect(dead.status).toBe("failed"); expect(dead.attempts).toBe(MAX_ATTEMPTS); expect(dead.html).toBeNull();
  });

  it("does not retry a rejected message, and never sends to a suppressed or expired one", async () => {
    const { db } = createTestDb(); const p = new PlatformRepository(db);
    mode = "bad";
    const r = await queueAndSend(db, env, msg, fakeFetch);
    expect((await p.emailOutboxById(r.id))!.status).toBe("failed");
    mode = "ok";
    await p.addSuppression("bounced@b.test", "bounce", null);
    const s = await queueAndSend(db, env, { ...msg, to: "bounced@b.test" }, fakeFetch);
    expect(s.error).toBe("suppressed");
    const e = await queueAndSend(db, env, { ...msg, expiresAt: new Date(Date.now() - 1000) }, fakeFetch);
    expect(e.error).toBe("expired");
    expect((await p.emailOutboxById(e.id))!.lastError).toMatch(/Expired/);
  });

  it("a platform admin can retry a failed message while its body is held", async () => {
    const { db } = createTestDb(); const p = new PlatformRepository(db); mode = "down";
    const r = await queueAndSend(db, env, msg, fakeFetch);
    mode = "ok";
    const again = await retryEmail(db, env, r.id, fakeFetch);
    expect("sent" in again && again.sent).toBe(true);
    expect((await p.emailOutboxById(r.id))!.status).toBe("sent");
    expect(await retryEmail(db, env, r.id, fakeFetch)).toEqual({ error: "Already sent" });
  });
});
