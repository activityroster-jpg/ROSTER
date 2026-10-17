import { beforeEach, describe, expect, it, vi } from "vitest";

// The webhook route reads the Worker env and DB through these; point them at the test DB.
const env: { BOATYJOBS_PARTNER_SECRET?: string; TENANT_CACHE: { get: (k: string) => Promise<string | null>; put: (k: string, v: string) => Promise<void> } } = {
  BOATYJOBS_PARTNER_SECRET: "test-partner-secret",
  TENANT_CACHE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } },
};
const kv = new Map<string, string>();
let currentDb: Database;
vi.mock("@/lib/cf/bindings", () => ({ getEnv: () => env, getDb: async () => currentDb }));
vi.mock("@/lib/security/rate-limit", () => ({ clientIp: () => "1.2.3.4", rateLimit: async () => ({ allowed: true }), tooManyRequests: () => new Response("slow down", { status: 429 }) }));

import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import type { Database } from "@/lib/db/client";
import { jobSync, type JobPost } from "@/lib/db/schema";
import { applyBoatyEvent, closeJob, createJob, editJob, parseBoatyEvent, publishJob, renewJob, retryJob, runJobSync, saveCentreDetails } from "@/lib/services/jobs";
import { backoffMs, buildPayload, canTakeSlot, MAX_LIVE_JOBS, postingAccess, REACTIVATE_MESSAGE, showHiringCard, SYNC_GIVE_UP_MS } from "@/lib/domain/jobs";
import { signBody, verifySignature } from "@/lib/boatyjobs/signature";
import { jobInputSchema, type JobInput } from "@/lib/validation/jobs";
import { POST as webhook } from "@/app/api/partner/boatyjobs/webhook/route";

const MIN = 60_000;
const HOUR = 60 * MIN;

function input(over: Partial<JobInput> = {}): JobInput {
  return jobInputSchema.parse({
    title: "Seasonal Dinghy Instructor",
    roleType: "dinghy_instructor",
    employmentType: "seasonal",
    positions: 2,
    startDate: "2027-04-01",
    endDate: "2027-09-30",
    payType: "weekly",
    payAmountGbp: 450,
    accommodation: true,
    locationText: "Weymouth, DT4 9DT",
    requiredQualifications: ["RYA Dinghy Instructor", "First aid"],
    description: "Teach RYA dinghy courses to adults and juniors through the 2027 season.",
    closingDate: "2027-02-28",
    applicationEmail: "jobs@alpha.test",
    ...over,
  });
}

interface Call { method: string; url: string; headers: Record<string, string>; body: unknown }

/** A fake Boaty Jobs: records every call and answers with the queued responses (default 200 with a listing). */
function fakeBoaty() {
  const calls: Call[] = [];
  const replies: { status: number; body: unknown }[] = [];
  let n = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = Object.fromEntries(Object.entries(init.headers as Record<string, string>));
    calls.push({ method: String(init.method), url: String(url), headers, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = replies.shift() ?? { status: 200, body: { listing_id: `lst_${++n}`, public_url: `https://boatyjobs.com/jobs/lst_${n}`, expires_at: "2027-02-28T23:59:59Z" } };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, replies, cfg: { secret: "test-partner-secret", fetchImpl } };
}

describe("Recruit on Boaty Jobs", () => {
  let db: Database;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let org: { id: string; jurisdiction: "england" };
  const now = new Date(Date.UTC(2026, 11, 5, 10)); // 5 Dec 2026

  beforeEach(async () => {
    kv.clear();
    ({ db } = createTestDb());
    currentDb = db;
    a = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    org = { id: a.organisationId, jurisdiction: "england" };
    // The shared seed queues a sync for its sample job; these tests start with an empty outbox.
    await a.repos.tenant.jobSync.updateWhere(a.ctx, eq(jobSync.status, "pending"), { status: "done" });
    await saveCentreDetails(a.repos, a.ctx, { town: "Weymouth", postcode: "DT4 9DT", region: null, website: "https://alpha.example", logoUrl: "", email: "jobs@alpha.test" }, now);
  });

  const job = async (id: string) => (await a.repos.tenant.jobPost.findById(a.ctx, id)) as JobPost;
  const syncs = async (jobId: string) => a.repos.tenant.jobSync.list(a.ctx, eq(jobSync.jobPostId, jobId));
  const newDraft = async (over: Partial<JobInput> = {}) => (await createJob(a.repos, a.ctx, input(over), null)).id;

  it("publishes: queues the call, sends it with the partner secret and an Idempotency-Key, and stores the listing", async () => {
    const id = await newDraft();
    const res = await publishJob(a.repos, a.ctx, id, org, now);
    expect(res.ok).toBe(true);
    expect((await job(id)).status).toBe("publishing");

    const boaty = fakeBoaty();
    const sum = await runJobSync(db, boaty.cfg, now);
    expect(sum.sent).toBe(1);
    const call = boaty.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://boatyjobs.com/api/partner/jobs");
    expect(call.headers.Authorization).toBe("Bearer test-partner-secret");
    expect(call.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    const body = call.body as ReturnType<typeof buildPayload>;
    expect(body.external_id).toBe(id);
    expect(body.centre).toMatchObject({ activityroster_centre_id: a.organisationId, name: "Alpha SC", town: "Weymouth", postcode: "DT4 9DT", region: "England" });
    expect(body.job).toMatchObject({ title: "Seasonal Dinghy Instructor", pay: { type: "weekly", amount_gbp: 450 }, accommodation: true, required_qualifications: ["RYA Dinghy Instructor", "First aid"], application_email: "jobs@alpha.test" });

    const live = await job(id);
    expect(live.status).toBe("live");
    expect(live.listingId).toBe("lst_1");
    expect(live.publicUrl).toBe("https://boatyjobs.com/jobs/lst_1");
    expect(new Date(live.expiresAt!).toISOString()).toBe("2027-02-28T23:59:59.000Z");
    expect(live.firstPublishedAt).toBeTruthy();
  });

  it("edits a live job by PATCHing Boaty Jobs; a draft edit sends nothing", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    await runJobSync(db, boaty.cfg, now);
    expect((await editJob(a.repos, a.ctx, id, input({ title: "Senior Dinghy Instructor" }), now)).ok).toBe(true);
    await runJobSync(db, boaty.cfg, now);
    const patch = boaty.calls[1]!;
    expect(patch.method).toBe("PATCH");
    expect(patch.url).toBe(`https://boatyjobs.com/api/partner/jobs/${id}`);
    expect((patch.body as { job: { title: string } }).job.title).toBe("Senior Dinghy Instructor");

    const draft = await newDraft();
    await editJob(a.repos, a.ctx, draft, input({ title: "Still a draft" }), now);
    expect(await syncs(draft)).toHaveLength(0);
  });

  it("closes a live job on Boaty Jobs", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    await runJobSync(db, boaty.cfg, now);
    expect((await closeJob(a.repos, a.ctx, id, now)).ok).toBe(true);
    expect((await job(id)).status).toBe("closed");
    await runJobSync(db, boaty.cfg, now);
    expect(boaty.calls[1]).toMatchObject({ method: "POST", url: `https://boatyjobs.com/api/partner/jobs/${id}/close` });
    expect((await job(id)).status).toBe("closed");
    expect((await closeJob(a.repos, a.ctx, id, now)).ok).toBe(false);
  });

  it("renews a closed job for another run, with a new Idempotency-Key", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    await runJobSync(db, boaty.cfg, now);
    await closeJob(a.repos, a.ctx, id, now);
    await runJobSync(db, boaty.cfg, now);
    const later = new Date(now.getTime() + 3 * HOUR);
    expect((await renewJob(a.repos, a.ctx, id, org, later)).ok).toBe(true);
    expect((await job(id)).status).toBe("publishing");
    boaty.replies.push({ status: 200, body: { listing_id: "lst_1", public_url: "https://boatyjobs.com/jobs/lst_1", expires_at: "2027-02-04T10:00:00Z" } });
    await runJobSync(db, boaty.cfg, later);
    const [first, , renew] = boaty.calls;
    expect(renew!.method).toBe("POST");
    expect(renew!.headers["Idempotency-Key"]).not.toBe(first!.headers["Idempotency-Key"]);
    const live = await job(id);
    expect(live.status).toBe("live");
    expect(new Date(live.expiresAt!).toISOString()).toBe("2027-02-04T10:00:00.000Z");
  });

  it("allows 5 live jobs and refuses a 6th", async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_LIVE_JOBS + 1; i++) ids.push(await newDraft({ title: `Job number ${i + 1}` }));
    for (const id of ids.slice(0, MAX_LIVE_JOBS)) expect((await publishJob(a.repos, a.ctx, id, org, now)).ok).toBe(true);
    const sixth = await publishJob(a.repos, a.ctx, ids[MAX_LIVE_JOBS]!, org, now);
    expect(sixth).toEqual({ ok: false, error: expect.stringContaining("up to 5 live jobs") });
    // Closing one frees a slot.
    await runJobSync(db, fakeBoaty().cfg, now);
    await closeJob(a.repos, a.ctx, ids[0]!, now);
    expect((await publishJob(a.repos, a.ctx, ids[MAX_LIVE_JOBS]!, org, now)).ok).toBe(true);
    // Renewing a job that is already live doesn't need another slot.
    expect(canTakeSlot((await a.repos.tenant.jobPost.list(a.ctx)), ids[1]!)).toBe(true);
  });

  it("won't publish without the centre's town and region, or after the closing date", async () => {
    const id = await newDraft({ closingDate: "2026-12-01" });
    expect((await publishJob(a.repos, a.ctx, id, org, now)).ok).toBe(false);
    await saveCentreDetails(a.repos, a.ctx, { town: "", postcode: "", region: null, website: "", logoUrl: "", email: "" }, now);
    const other = await newDraft();
    const res = await publishJob(a.repos, a.ctx, other, { id: a.organisationId, jurisdiction: "england" }, now);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("town and region") });
  });

  it("blocks a frozen or cancelled centre; a paying plan or an active trial may post", () => {
    const base = { orgStatus: "active" as const, subscriptionStatus: "active", trialKind: "paid" as const, readOnly: false };
    expect(postingAccess(base)).toEqual({ kind: "post" });
    expect(postingAccess({ ...base, subscriptionStatus: "past_due" })).toEqual({ kind: "post" });
    expect(postingAccess({ ...base, subscriptionStatus: null, trialKind: "trial" })).toEqual({ kind: "post" });
    expect(postingAccess({ ...base, readOnly: true })).toEqual({ kind: "read_only", reason: REACTIVATE_MESSAGE });
    expect(postingAccess({ ...base, orgStatus: "cancelled" })).toEqual({ kind: "read_only", reason: REACTIVATE_MESSAGE });
    expect(postingAccess({ ...base, orgStatus: "suspended" }).kind).toBe("read_only");
    expect(postingAccess({ ...base, subscriptionStatus: "canceled" }).kind).toBe("read_only");
    expect(postingAccess({ ...base, subscriptionStatus: null, trialKind: "read_only" }).kind).toBe("read_only");
  });

  it("a frozen (read-only) centre's repository refuses job writes", async () => {
    const frozen = { organisationId: a.organisationId, slug: "alpha", userId: "u", role: "owner" as const, readOnly: "trial" as const };
    await expect(createJob(a.repos, frozen, input(), "u")).rejects.toThrow();
  });

  it("retries with backoff, then marks sync_failed after 24 hours; Retry resends with the same key", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    boaty.replies.push({ status: 503, body: { error: "down for maintenance" } });
    const first = await runJobSync(db, boaty.cfg, now);
    expect(first).toMatchObject({ sent: 0, retrying: 1, failed: 0 });
    const [s] = await syncs(id);
    expect(s!.attempts).toBe(1);
    expect(Number(s!.nextAttemptAt)).toBe(now.getTime() + backoffMs(1));
    expect((await job(id)).status).toBe("publishing");

    // Not due yet: nothing is sent.
    expect((await runJobSync(db, boaty.cfg, new Date(now.getTime() + 10_000))).due).toBe(0);

    // Still failing a day later: give up.
    boaty.replies.push({ status: 500, body: {} });
    const late = new Date(now.getTime() + SYNC_GIVE_UP_MS + MIN);
    expect((await runJobSync(db, boaty.cfg, late)).failed).toBe(1);
    const failed = await job(id);
    expect(failed.status).toBe("sync_failed");
    expect(failed.syncError).toContain("Boaty Jobs said");

    expect((await retryJob(a.repos, a.ctx, id, late)).ok).toBe(true);
    expect((await job(id)).status).toBe("publishing");
    await runJobSync(db, boaty.cfg, late);
    expect((await job(id)).status).toBe("live");
    const keys = boaty.calls.map((c) => c.headers["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(1);
  });

  it("a refused listing (4xx) fails straight away, without waiting 24 hours", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    boaty.replies.push({ status: 422, body: { error: "closing_date must be within 90 days" } });
    expect((await runJobSync(db, boaty.cfg, now)).failed).toBe(1);
    const j = await job(id);
    expect(j.status).toBe("sync_failed");
    expect(j.syncError).toContain("closing_date must be within 90 days");
  });

  it("no partner secret yet: keeps retrying, never sends", async () => {
    const id = await newDraft();
    await publishJob(a.repos, a.ctx, id, org, now);
    const boaty = fakeBoaty();
    expect((await runJobSync(db, { ...boaty.cfg, secret: undefined }, now)).retrying).toBe(1);
    expect(boaty.calls).toHaveLength(0);
  });

  describe("webhook", () => {
    async function liveJob() {
      const id = await newDraft();
      await publishJob(a.repos, a.ctx, id, org, now);
      await runJobSync(db, fakeBoaty().cfg, now);
      return id;
    }
    async function post(body: unknown, signature?: string) {
      const raw = JSON.stringify(body);
      const sig = signature ?? (await signBody("test-partner-secret", raw));
      return webhook(new Request("https://activityroster.com/api/partner/boatyjobs/webhook", { method: "POST", body: raw, headers: { "X-BoatyJobs-Signature": sig } }));
    }

    it("rejects a wrong or missing signature and changes nothing", async () => {
      const id = await liveJob();
      const evt = { id: "evt_1", type: "listing.removed", data: { external_id: id, reason: "spam" } };
      expect((await post(evt, "0".repeat(64))).status).toBe(401);
      expect((await post(evt, await signBody("someone-else", JSON.stringify(evt)))).status).toBe(401);
      expect((await webhook(new Request("https://x/api/partner/boatyjobs/webhook", { method: "POST", body: JSON.stringify(evt) }))).status).toBe(401);
      expect((await job(id)).status).toBe("live");
      expect(await verifySignature("s", "body", "sha256=" + (await signBody("s", "body")))).toBe(true);
      expect(await verifySignature(undefined, "body", await signBody("s", "body"))).toBe(false);
    });

    it("refuses everything when no secret is configured", async () => {
      const saved = env.BOATYJOBS_PARTNER_SECRET;
      env.BOATYJOBS_PARTNER_SECRET = undefined;
      try {
        expect((await post({ type: "listing.published", data: { external_id: crypto.randomUUID() } })).status).toBe(503);
      } finally {
        env.BOATYJOBS_PARTNER_SECRET = saved;
      }
    });

    it("listing.published → live with the listing details", async () => {
      const id = await newDraft();
      await publishJob(a.repos, a.ctx, id, org, now);
      const res = await post({ id: "evt_pub", type: "listing.published", data: { external_id: id, listing_id: "lst_9", public_url: "https://boatyjobs.com/jobs/lst_9", expires_at: "2027-02-01T00:00:00Z" } });
      expect(res.status).toBe(200);
      const j = await job(id);
      expect(j).toMatchObject({ status: "live", listingId: "lst_9", publicUrl: "https://boatyjobs.com/jobs/lst_9" });
    });

    it("listing.expired → expired", async () => {
      const id = await liveJob();
      await post({ id: "evt_exp", type: "listing.expired", data: { external_id: id } });
      expect((await job(id)).status).toBe("expired");
    });

    it("listing.removed → removed, with the reason kept for the centre", async () => {
      const id = await liveJob();
      await post({ id: "evt_rm", type: "listing.removed", data: { external_id: id, reason: "Pay below minimum wage" } });
      const j = await job(id);
      expect(j.status).toBe("removed");
      expect(j.removedReason).toBe("Pay below minimum wage");
    });

    it("application.received → the count goes up, once per event id", async () => {
      const id = await liveJob();
      await post({ id: "evt_a1", type: "application.received", data: { external_id: id } });
      await post({ id: "evt_a2", type: "application.received", data: { external_id: id } });
      await post({ id: "evt_a2", type: "application.received", data: { external_id: id } }); // redelivered
      expect((await job(id)).applicationsCount).toBe(2);
    });

    it("ignores unknown events and jobs that don't exist", async () => {
      expect(parseBoatyEvent({ type: "listing.renamed", data: { external_id: crypto.randomUUID() } })).toBeNull();
      const ev = parseBoatyEvent({ type: "listing.expired", data: { external_id: crypto.randomUUID() } })!;
      expect(await applyBoatyEvent(db, ev)).toBe("ignored");
    });
  });

  it("the hiring card shows 1 Dec – 30 Apr, until dismissed for that season", () => {
    expect(showHiringCard(new Date(Date.UTC(2026, 11, 1)), null)).toBe(true);
    expect(showHiringCard(new Date(Date.UTC(2027, 3, 30)), null)).toBe(true);
    expect(showHiringCard(new Date(Date.UTC(2027, 4, 1)), null)).toBe(false);
    expect(showHiringCard(new Date(Date.UTC(2026, 10, 30)), null)).toBe(false);
    const dismissed = Date.UTC(2027, 0, 10);
    expect(showHiringCard(new Date(Date.UTC(2027, 1, 1)), dismissed)).toBe(false);
    expect(showHiringCard(new Date(Date.UTC(2027, 11, 2)), dismissed)).toBe(true); // next season
  });

  it("validates the editor: pay amount unless competitive, end after start, description length", () => {
    expect(jobInputSchema.safeParse({ ...input(), payType: "daily", payAmountGbp: null }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...input(), payType: "competitive", payAmountGbp: null }).success).toBe(true);
    expect(jobInputSchema.safeParse({ ...input(), endDate: "2027-01-01" }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...input(), description: "x".repeat(5001) }).success).toBe(false);
    expect(jobInputSchema.safeParse({ ...input(), applicationEmail: "not-an-email" }).success).toBe(false);
  });
});
