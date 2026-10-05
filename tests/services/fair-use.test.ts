import { beforeEach, describe, expect, it, vi } from "vitest";

const magicLinks: string[] = [];
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({ api: { signInMagicLink: vi.fn(async ({ body }: { body: { email: string } }) => { magicLinks.push(body.email); }) } }),
}));
vi.mock("@/lib/cf/bindings", () => ({ getEnv: () => ({ TENANT_CACHE: { put: async () => {} }, APP_APEX_DOMAIN: "activityroster.com" }) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { sendInvite, sweepQueuedInvites } from "@/lib/auth/invite-link";
import { takeInviteSlot } from "@/lib/services/invite-cap";
import { centresOverAlert, fairUseSchema, fairUseSettings, headcount } from "@/lib/services/fair-use";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Database } from "@/lib/db/client";

const DAY = 86_400_000;

describe("fair use: daily invite cap per centre", () => {
  let db: Database;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;

  beforeEach(async () => {
    magicLinks.length = 0;
    ({ db } = createTestDb());
    a = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Bravo SC", slug: "bravo", jurisdiction: "england" });
    await new PlatformRepository(db).upsertPricing({ inviteDailyCap: 2 });
  });

  async function invitee(org: typeof a, email: string) {
    const u = await org.repos.control.createUser({ name: email, email });
    await org.repos.control.createMembership({ userId: u.id, organisationId: org.organisationId, role: "instructor" }, "invited");
    return u.id;
  }
  const invite = (org: typeof a, email: string, userId: string) =>
    sendInvite(org.repos, org.ctx, { email, userId, kind: "instructor", centreName: org.slug, slug: org.slug, callbackPath: "/portal/welcome", inviterName: "Ellie" });

  it("counts per centre per day", async () => {
    const now = Date.UTC(2026, 9, 5, 10);
    expect(await takeInviteSlot(a.repos.control, a.organisationId, 2, now)).toBe(true);
    expect(await takeInviteSlot(a.repos.control, a.organisationId, 2, now)).toBe(true);
    expect(await takeInviteSlot(a.repos.control, a.organisationId, 2, now)).toBe(false);
    expect(await takeInviteSlot(b.repos.control, b.organisationId, 2, now)).toBe(true);
    expect(await takeInviteSlot(a.repos.control, a.organisationId, 2, now + DAY)).toBe(true);
  });

  it("sends up to the cap, queues the rest, and shows them as going tomorrow", async () => {
    const ids = [await invitee(a, "one@x.org"), await invitee(a, "two@x.org"), await invitee(a, "three@x.org")];
    expect(await invite(a, "one@x.org", ids[0]!)).toBe("sent");
    expect(await invite(a, "two@x.org", ids[1]!)).toBe("sent");
    expect(await invite(a, "three@x.org", ids[2]!)).toBe("queued");
    expect(magicLinks).toEqual(["one@x.org", "two@x.org"]);
    expect([...(await a.repos.control.inviteQueuedUsers(a.organisationId))]).toEqual([ids[2]]);
    // Another centre has its own allowance.
    const other = await invitee(b, "bravo@x.org");
    expect(await invite(b, "bravo@x.org", other)).toBe("sent");
  });

  it("the hourly sweep holds queued invites until the allowance opens, then sends them", async () => {
    const ids = [await invitee(a, "one@x.org"), await invitee(a, "two@x.org"), await invitee(a, "three@x.org")];
    for (const [i, e] of ["one@x.org", "two@x.org", "three@x.org"].entries()) await invite(a, e, ids[i]!);
    // Same day: still full.
    const sameDay = await sweepQueuedInvites(a.repos);
    expect(sameDay).toMatchObject({ queued: 1, sent: 0, held: 1 });
    // Next day: the counter's window has moved on.
    vi.useFakeTimers({ now: Date.now() + DAY, toFake: ["Date"] });
    try {
      const next = await sweepQueuedInvites(a.repos);
      expect(next).toMatchObject({ queued: 1, sent: 1, held: 0 });
    } finally { vi.useRealTimers(); }
    expect(magicLinks).toContain("three@x.org");
    expect((await a.repos.control.inviteQueuedUsers(a.organisationId)).size).toBe(0);
    expect((await a.repos.control.inviteSentByUser(a.organisationId)).has(ids[2]!)).toBe(true);
  });

  it("does not queue invites for people who have already joined", async () => {
    const id = await invitee(a, "joined@x.org");
    await a.repos.control.queueInvite(id, a.organisationId, null);
    await a.repos.control.acceptInvitedMembership(id, a.organisationId);
    expect(await a.repos.control.queuedInvites()).toHaveLength(0);
  });
});

describe("fair use: settings and the Dev Center alert", () => {
  it("defaults to 500 / 300 / 200 and validates edits", async () => {
    const { db } = createTestDb();
    expect(await fairUseSettings(db)).toEqual({ fairUsePeople: 500, fairUseAlertAt: 300, inviteDailyCap: 200 });
    expect(fairUseSchema.safeParse({ fairUsePeople: 500, fairUseAlertAt: 300, inviteDailyCap: 200 }).success).toBe(true);
    expect(fairUseSchema.safeParse({ fairUsePeople: 300, fairUseAlertAt: 500, inviteDailyCap: 200 }).success).toBe(false);
    expect(fairUseSchema.safeParse({ fairUsePeople: 500, fairUseAlertAt: 300, inviteDailyCap: 0 }).success).toBe(false);
    expect(fairUseSchema.safeParse({ fairUsePeople: "abc", fairUseAlertAt: 300, inviteDailyCap: 200 }).success).toBe(false);
  });

  it("lists centres at or over the alert level, biggest first, without blocking anyone", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    await seedFullOrg(db, { name: "Bravo SC", slug: "bravo", jurisdiction: "england" });
    for (let i = 0; i < 4; i++) await a.repos.tenant.instructor.insert(a.ctx, { name: `Extra ${i}`, status: "active", employmentType: "volunteer" });
    expect(await headcount(db, { id: a.organisationId, slug: "alpha" })).toBe(5);
    const flagged = await centresOverAlert(db, 3);
    expect(flagged.map((c) => [c.slug, c.people])).toEqual([["alpha", 5]]);
  });
});
