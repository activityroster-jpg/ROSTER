import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({ deleteDocument: vi.fn(async () => {}) }));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async (m: { to: string; subject: string }) => { sent.push(m); }), escapeHtml: (s: unknown) => String(s ?? "") }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { parseRetention, retentionPlan, runRetention, sendRetentionReminder, GRACE_DAYS } from "@/lib/services/retention";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type Database from "better-sqlite3";

const DAY = 86_400_000;
const monthsAgo = (m: number, extraDays = 0) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - m); return new Date(d.getTime() - extraDays * DAY); };
const env = { APP_APEX_DOMAIN: "activityroster.com" } as unknown as CloudflareEnv;

describe("data retention", () => {
  let repos: Repositories; let ctx: SystemTenantContext; let raw: Database.Database; let settingsId: string;
  beforeEach(async () => {
    sent.length = 0;
    const t = createTestDb(); raw = t.raw;
    const seeded = await seedFullOrg(t.db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    settingsId = (await repos.tenant.orgSettings.list(ctx))[0]!.id;
  });

  it("parses settings with floors and defaults", () => {
    expect(parseRetention(null).staffMonths).toBe(12);
    expect(parseRetention(JSON.stringify({ clockMonths: 12, auditMonths: 1, staffMonths: 6 }))).toMatchObject({ clockMonths: 72, auditMonths: 36, staffMonths: 6 });
  });

  it("counts what is in the window, reminds admins once, then removes it after the grace period", async () => {
    // A former instructor who left 13 months ago (past 12 months, inside the 14-day window → not yet overdue? 13 months is > 12 months + 14 days → overdue).
    const gone = await repos.tenant.instructor.insert(ctx, { name: "Old Hand", email: "old@a.test", employmentType: "freelance", status: "inactive", leftAt: monthsAgo(13) });
    // One who left exactly 12 months + 3 days ago: in the window, not yet overdue.
    const recent = await repos.tenant.instructor.insert(ctx, { name: "Just Left", email: "just@a.test", employmentType: "freelance", status: "inactive", leftAt: monthsAgo(12, 3) });
    const active = (await repos.tenant.instructor.list(ctx)).find((i) => i.status === "active")!;
    await repos.tenant.availability.insert(ctx, { instructorId: active.id, date: "2020-01-05", slot: "AM", status: "available" });
    await repos.tenant.leaveRequest.insert(ctx, { instructorId: active.id, type: "holiday", startDate: "2020-06-01", endDate: "2020-06-07", reason: null, status: "approved" } as never);

    const plan = await retentionPlan(repos, ctx, (await repos.tenant.orgSettings.list(ctx))[0], new Date());
    expect(plan.pending.staff).toBe(2);
    expect(plan.due.staff).toBe(1);
    expect(plan.pending.availability).toBe(1);
    expect(plan.pending.leave).toBe(1);
    expect(plan.staffDue.find((s) => s.id === recent.id)?.overdue).toBe(false);

    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    expect(await sendRetentionReminder(repos, ctx, env, settings, new Date())).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toMatch(/due for deletion in 14 days/);
    // Not again within a fortnight.
    expect(await sendRetentionReminder(repos, ctx, env, (await repos.tenant.orgSettings.list(ctx))[0]!, new Date())).toBe(false);

    const removed = await runRetention(repos, ctx, settings, new Date());
    expect(removed.staff).toBe(1);
    expect(removed.availability).toBe(1);
    expect(removed.leave).toBe(1);
    expect((await repos.tenant.instructor.findById(ctx, gone.id))!.name).toBe("Former staff member");
    expect((await repos.tenant.instructor.findById(ctx, recent.id))!.name).toBe("Just Left");
    expect((await repos.tenant.deletionLog.list(ctx)).some((l) => l.subjectKind === "retention")).toBe(true);
    // Idempotent: a second run removes nothing more.
    expect(Object.values(await runRetention(repos, ctx, settings, new Date())).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("the change log can be trimmed only once rows are older than 3 years", async () => {
    const orgId = ctx.organisationId;
    const old = Date.now() - 4 * 365 * DAY;
    raw.prepare("INSERT INTO audit_log (id, organisation_id, actor_user_id, action, entity, entity_id, before, after, created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("old-audit", orgId, null, "update", "course", null, null, null, old);
    raw.prepare("INSERT INTO audit_log (id, organisation_id, actor_user_id, action, entity, entity_id, before, after, created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("new-audit", orgId, null, "update", "course", null, null, null, Date.now());
    expect(() => raw.prepare("DELETE FROM audit_log WHERE id = 'new-audit'").run()).toThrow(/append-only/);
    expect(raw.prepare("DELETE FROM audit_log WHERE id = 'old-audit'").run().changes).toBe(1);
    const removed = await runRetention(repos, ctx, { retention: "{}" }, new Date());
    expect(removed.audit).toBe(0); // nothing else old enough
    void settingsId; void GRACE_DAYS;
  });
});
