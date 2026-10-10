import { beforeEach, describe, expect, it, vi } from "vitest";

const queueEmails = vi.fn(async (msgs: unknown[]) => ({ queued: msgs.length }));
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), queueEmails: (msgs: unknown[]) => queueEmails(msgs), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0, dead: [] })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { remindStaff } from "@/lib/services/staff-reminders";
import { stripMarkers } from "@/lib/notify/markers";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

/**
 * The staff list's "Remind" buttons: a notice in the app plus an email, only
 * for people who still need it, at most once a day each, never to restricted
 * people or people whose availability the office keeps.
 */
describe("reminding staff", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;

  beforeEach(async () => {
    queueEmails.mockClear();
    ({ repos, ctx } = await seedFullOrg(createTestDb().db, { name: "Remind", slug: "remind", jurisdiction: "england" }));
  });

  const person = async (name: string, extra: Record<string, unknown> = {}, withApp = true) => {
    const user = withApp ? await repos.control.createUser({ name, email: `${name.toLowerCase()}@remind.test` }) : null;
    return repos.tenant.instructor.insert(ctx, { name, email: `${name.toLowerCase()}@remind.test`, employmentType: "employed", status: "active", userId: user?.id ?? null, ...extra });
  };

  it("availability: reminds app users with nothing on file, once a day, and skips the rest", async () => {
    const ana = await person("Ana");
    const ben = await person("Ben");
    await repos.tenant.availability.insert(ctx, { instructorId: ben.id, weekday: 6, slot: "AM", status: "available" });
    const cat = await person("Cat", { managedBy: "office" });
    const dee = await person("Dee", { restrictedAt: new Date() });
    const eve = await person("Eve", {}, false); // not signed up: invite them instead

    const ids = [ana, ben, cat, dee, eve].map((p) => p.id);
    const first = await remindStaff(repos, ctx, "availability", ids, "Remind Centre");
    expect(first.sent).toBe(1);
    expect(first.unreachable).toBe(1);
    const mine = new Set(ids);
    const notes = (await repos.tenant.notification.list(ctx)).filter((n) => n.instructorId && mine.has(n.instructorId));
    expect(notes.map((n) => n.instructorId)).toEqual([ana.id]);
    expect(notes[0]!.title).toBe("Remind Centre: please mark when you're free");
    // People see the message without the internal tag.
    expect(stripMarkers(notes[0]!.body)).not.toContain("[remind:");
    expect(notes[0]!.body).toContain("[remind:availability]");
    expect((queueEmails.mock.calls[0]![0] as { to: string; html: string }[]).map((m) => m.to)).toEqual(["ana@remind.test"]);
    expect((queueEmails.mock.calls[0]![0] as { html: string }[])[0]!.html).not.toContain("[remind:");

    const again = await remindStaff(repos, ctx, "availability", ids, "Remind Centre");
    expect(again.sent).toBe(0);
    expect(again.recent).toBe(1);
    expect((await repos.tenant.notification.list(ctx)).filter((n) => n.instructorId && mine.has(n.instructorId))).toHaveLength(1);
    // The change log records who was reminded.
    expect((await repos.tenant.auditLog.list(ctx)).filter((a) => a.action === "notify")).toHaveLength(1);
  });

  it("licences: reminds people missing a required check, by email even without the app, listing what's missing", async () => {
    const dbs = await repos.tenant.complianceType.insert(ctx, { name: "Enhanced DBS", code: "dbs-test", mandatory: true, expiryTracked: true, active: true });
    const fia = await person("Fia", {}, false); // no checks at all, no app
    const r = await remindStaff(repos, ctx, "licences", [fia.id], "Remind Centre");
    expect(r.sent).toBe(1);
    const note = (await repos.tenant.notification.list(ctx)).find((n) => n.instructorId === fia.id)!;
    expect(note.title).toBe("Remind Centre: please update your licences");
    expect(note.body).toContain(`${dbs.name} is missing`);
    expect((queueEmails.mock.calls[0]![0] as { to: string }[]).map((m) => m.to)).toEqual(["fia@remind.test"]);
  });
});

describe("stripMarkers", () => {
  it("removes internal tags and leaves the message", () => {
    expect(stripMarkers("It runs out on 2026-08-01. Renew it. [expiry:qualification:abc123]")).toBe("It runs out on 2026-08-01. Renew it.");
    expect(stripMarkers("Mark when you're free. [remind:availability]")).toBe("Mark when you're free.");
    expect(stripMarkers(null)).toBeNull();
  });
});
