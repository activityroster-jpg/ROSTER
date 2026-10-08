import { beforeEach, describe, expect, it, vi } from "vitest";

const queueEmails = vi.fn(async (msgs: unknown[]) => ({ queued: msgs.length }));
const sendPush = vi.fn(async (_env: unknown, tokens: string[]) => ({ sent: tokens.length, dead: tokens.filter((t) => t.startsWith("dead")) }));
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), queueEmails: (msgs: unknown[]) => queueEmails(msgs), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: (env: unknown, tokens: string[]) => sendPush(env, tokens) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { notifyInstructors } from "@/lib/services/notifications";
import { drainPushQueue } from "@/lib/push/queue";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Database } from "@/lib/db/client";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { CloudflareEnv } from "@/lib/cf/bindings";

/**
 * Bulk notices (publishing a week): the in-app notifications are written at
 * once, in batches; emails and phone pushes are queued, and the delivery job
 * sends the pushes to each person's phones.
 */
describe("notifying many people at once", () => {
  let db: Database;
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    queueEmails.mockClear(); sendPush.mockClear();
    db = createTestDb().db;
    ({ repos, ctx } = await seedFullOrg(db, { name: "Bulk", slug: "bulk", jurisdiction: "england" }));
  });

  it("writes everyone's in-app notice, queues their pushes and emails, and skips restricted people", async () => {
    const t = repos.tenant;
    const withApp = await repos.control.createUser({ name: "Ana", email: "ana@bulk.test" });
    const ana = await t.instructor.insert(ctx, { name: "Ana", email: "ana@bulk.test", employmentType: "employed", status: "active", userId: withApp.id });
    const ben = await t.instructor.insert(ctx, { name: "Ben", email: "ben@bulk.test", employmentType: "employed", status: "active", notifyEmail: false });
    const cat = await t.instructor.insert(ctx, { name: "Cat", email: null, employmentType: "volunteer", status: "active" });
    const dee = await t.instructor.insert(ctx, { name: "Dee", email: "dee@bulk.test", employmentType: "employed", status: "active", restrictedAt: new Date() });

    const n = await notifyInstructors(repos, ctx, [ana, ben, cat, dee].map((p) => ({ instructorId: p.id, input: { title: `Hi ${p.name}`, body: "Roster out", email: true } })));

    expect(n).toBe(3);
    const notes = await t.notification.list(ctx);
    expect(notes.map((x) => x.title).filter((x) => x.startsWith("Hi ")).sort()).toEqual(["Hi Ana", "Hi Ben", "Hi Cat"]);
    // Email only to people with an address who haven't switched email off.
    expect(queueEmails).toHaveBeenCalledTimes(1);
    expect((queueEmails.mock.calls[0]![0] as { to: string }[]).map((m) => m.to)).toEqual(["ana@bulk.test"]);
    // A push is queued only for someone with a login (the app).
    const pushes = await new PlatformRepository(db).duePushes();
    expect(pushes.map((p) => [p.userId, p.title])).toEqual([[withApp.id, "Hi Ana"]]);
  });

  it("the delivery job sends each queued push to that person's phones and clears dead ones", async () => {
    const u1 = await repos.control.createUser({ name: "One", email: "one@bulk.test" });
    const u2 = await repos.control.createUser({ name: "Two", email: "two@bulk.test" });
    const u3 = await repos.control.createUser({ name: "Three", email: "three@bulk.test" });
    await repos.control.upsertPushToken({ userId: u1.id, token: "tok-1a", platform: "ios", deviceId: "a" });
    await repos.control.upsertPushToken({ userId: u1.id, token: "dead-1b", platform: "android", deviceId: "b" });
    await repos.control.upsertPushToken({ userId: u2.id, token: "tok-2", platform: "ios", deviceId: "c" });
    const p = new PlatformRepository(db);
    await p.enqueuePushes([u1, u2, u3].map((u) => ({ userId: u.id, title: "Roster published", body: null, url: null })));

    const r = await drainPushQueue(db, {} as CloudflareEnv);

    expect(r).toEqual({ due: 3, sent: 3, dead: 1 });
    expect(sendPush.mock.calls.map((c) => [...c[1]].sort())).toEqual(expect.arrayContaining([["dead-1b", "tok-1a"], ["tok-2"]]));
    expect(sendPush).toHaveBeenCalledTimes(2); // nobody's phone for Three: nothing to send
    expect(await p.duePushes()).toEqual([]);
    expect((await repos.control.pushTokensForUser(u1.id)).map((x) => x.token)).toEqual(["tok-1a"]);
    expect((await drainPushQueue(db, {} as CloudflareEnv)).due).toBe(0);
  });

  it("queues hundreds of pushes in a handful of statements", async () => {
    const users = [];
    for (let i = 0; i < 250; i++) users.push(await repos.control.createUser({ name: `U${i}`, email: `u${i}@bulk.test` }));
    const p = new PlatformRepository(db);
    expect(await p.enqueuePushes(users.map((u) => ({ userId: u.id, title: "Hi", body: null, url: null })))).toBe(250);
    expect((await p.duePushes(500)).length).toBe(250);
  });
});
