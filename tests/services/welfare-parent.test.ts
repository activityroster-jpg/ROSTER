import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));
vi.mock("@/lib/security/token-crypto", () => ({ openToken: vi.fn(async (v: string | null) => v), sealToken: vi.fn(async (v: string) => v), isSealed: () => false }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { defaultWelfareFor, parseWelfareSettings, setWelfareDuty, welfareForRange } from "@/lib/services/welfare";
import { getWeekRota } from "@/lib/services/schedule";
import { assignStaff } from "@/lib/services/assignment";
import { inviteGuardian, parentApprovalFromLinks, recordParentDecision } from "@/lib/services/guardians";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";

describe("welfare officers: names, a default pattern, per-day overrides", () => {
  it("reads settings defensively and resolves the default by weekday", () => {
    const s = parseWelfareSettings('["Sam Patel","Jo Murphy", 3, ""]', '[{"weekday":6,"slot":"AM","name":"Sam Patel"},{"weekday":9,"slot":"AM","name":"x"}]');
    expect(s.officers).toEqual(["Sam Patel", "Jo Murphy"]);
    expect(s.defaults).toHaveLength(1);
    expect(defaultWelfareFor(s, "2026-01-10", "AM")).toBe("Sam Patel"); // a Saturday
    expect(defaultWelfareFor(s, "2026-01-10", "PM")).toBeNull();
    expect(parseWelfareSettings("{", null).officers).toEqual([]);
  });

  it("an override wins for one day and the roster carries the name", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, settings.id, { welfareOfficers: JSON.stringify(["Sam Patel", "Jo Murphy"]), welfareDuty: JSON.stringify([{ weekday: 1, slot: "AM", name: "Sam Patel" }]) });
    await setWelfareDuty(repos, ctx, "2026-01-05", "AM", null); // the fixture seeds an override here; back to the default pattern
    await setWelfareDuty(repos, ctx, "2026-01-05", "PM", "Jo Murphy");
    const { byDate } = await welfareForRange(repos, ctx, "2026-01-05", "2026-01-12");
    expect(byDate.get("2026-01-05")).toEqual({ AM: "Sam Patel", PM: "Jo Murphy" });
    expect(byDate.get("2026-01-12")).toBeUndefined();
    const rota = await getWeekRota(repos, ctx, "2026-01-05");
    expect(rota[0]!.welfare).toEqual({ AM: "Sam Patel", PM: "Jo Murphy" });
    await setWelfareDuty(repos, ctx, "2026-01-05", "PM", null);
    expect((await welfareForRange(repos, ctx, "2026-01-05", "2026-01-06")).byDate.get("2026-01-05")).toEqual({ AM: "Sam Patel" });
  });
});

describe("parental approval before an under-18 is rostered", () => {
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;
  let roleTypeId: string;
  let courseId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos; ctx = seeded.ctx;
    const a = (await repos.tenant.courseStaff.list(ctx))[0]!;
    roleTypeId = a.roleTypeId;
    const ct = (await repos.tenant.courseType.list(ctx))[0]!;
    const course = await repos.tenant.course.insert(ctx, { courseTypeId: ct.id, name: "Youth week", capacity: 6, ratio: 6, status: "scheduled" });
    courseId = course.id;
    // A 16-year-old with a parent's email on file.
    const dob = new Date(); dob.setUTCFullYear(dob.getUTCFullYear() - 16);
    const young = await repos.tenant.instructor.insert(ctx, { name: "Kai Young", email: "kai@alpha.test", employmentType: "employed", status: "active", dateOfBirth: dob.toISOString().slice(0, 10), guardianName: "Pat Young", guardianEmail: "pat@alpha.test", notifyEmail: true });
    instructorId = young.id;
  });

  it("blocks until a parent approves, allows an override with a note, and follows the parent's later answer", async () => {
    expect(parentApprovalFromLinks("2010-01-01", [])).toBe("none");
    const first = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe("parent-approval");

    const inv = await inviteGuardian(repos, ctx, instructorId, "asked at sign-up");
    expect(inv.ok).toBe(true);
    if (!inv.ok) return;
    const pending = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId });
    expect(pending.ok).toBe(false);
    if (!pending.ok) expect(pending.detail).toMatch(/hasn't approved yet/);

    const r = await recordParentDecision(repos, ctx, inv.linkId, inv.userId, "approved");
    expect(r.ok).toBe(true);
    const ok = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.overridden).toBe(false);

    // Withdrawn later: blocked again, but an admin may override with a note (recorded).
    await recordParentDecision(repos, ctx, inv.linkId, inv.userId, "withdrawn");
    const course2 = await repos.tenant.course.insert(ctx, { courseTypeId: (await repos.tenant.courseType.list(ctx))[0]!.id, name: "Another", capacity: 6, ratio: 6, status: "scheduled" });
    const blocked = await assignStaff(repos, ctx, { courseId: course2.id, instructorId, roleTypeId });
    expect(blocked.ok).toBe(false);
    const forced = await assignStaff(repos, ctx, { courseId: course2.id, instructorId, roleTypeId, override: true, overrideNote: "Signed paper form on file" });
    expect(forced.ok).toBe(true);
    if (forced.ok) expect(forced.overridden).toBe(true);
    // Someone else's link cannot be answered.
    expect((await recordParentDecision(repos, ctx, inv.linkId, "someone-else", "approved")).ok).toBe(false);
  });

  it("the centre can switch the requirement off", async () => {
    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, settings.id, { requireParentApproval: false });
    const r = await assignStaff(repos, ctx, { courseId, instructorId, roleTypeId });
    expect(r.ok).toBe(true);
  });
});
