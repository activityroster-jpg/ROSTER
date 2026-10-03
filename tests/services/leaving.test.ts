import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); }),
  escapeHtml: (s: unknown) => String(s ?? ""),
}));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { leavingDeadline, onOrganisationStatusChanged, sweepLeaving, LEAVING_DAYS } from "@/lib/services/leaving";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const env = { APP_APEX_DOMAIN: "activityroster.com", PLATFORM_ADMIN_EMAILS: "conor@platform.test" } as unknown as CloudflareEnv;
const DAY = 86_400_000;

describe("leaving a centre", () => {
  beforeEach(() => { sent.length = 0; });

  it("stamps the status change and sends the written confirmation with the 90-day window", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const t0 = new Date("2026-10-03T12:00:00Z");
    const before = (await repos.control.organisationById(organisationId))!;
    expect(leavingDeadline(before)).toBeNull();
    const updated = (await repos.control.updateOrganisation(organisationId, { status: "cancelled" }))!;
    const r = await onOrganisationStatusChanged(db, env, updated, before.status, t0);
    expect(r.notified).toBe(true);
    const after = (await repos.control.organisationById(organisationId))!;
    expect(after.statusChangedAt?.toISOString()).toBe(t0.toISOString());
    expect(leavingDeadline(after)?.getTime()).toBe(t0.getTime() + LEAVING_DAYS * DAY);
    expect(sent.map((s) => s.to).sort()).toEqual(["conor@platform.test", "owner@alpha.test"]);
    expect(sent[0]!.subject).toMatch(/available until/);
  });

  it("reminds admins 14 days before, tells the owner at 90 days, each only once, and never deletes", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const t0 = new Date("2026-10-03T12:00:00Z");
    const updated = (await repos.control.updateOrganisation(organisationId, { status: "suspended" }))!;
    await onOrganisationStatusChanged(db, env, updated, "active", t0);
    sent.length = 0;

    expect(await sweepLeaving(db, env, new Date(t0.getTime() + 60 * DAY))).toEqual({ checked: 1, reminded: 0, due: 0 });
    expect(await sweepLeaving(db, env, new Date(t0.getTime() + 80 * DAY))).toEqual({ checked: 1, reminded: 1, due: 0 });
    expect(sent).toEqual([{ to: "owner@alpha.test", subject: expect.stringMatching(/deleted in 10 days/) }]);
    expect(await sweepLeaving(db, env, new Date(t0.getTime() + 81 * DAY))).toEqual({ checked: 1, reminded: 0, due: 0 });

    sent.length = 0;
    expect(await sweepLeaving(db, env, new Date(t0.getTime() + 91 * DAY))).toEqual({ checked: 1, reminded: 0, due: 1 });
    expect(sent).toEqual([{ to: "conor@platform.test", subject: "Ready to erase: Alpha" }]);
    expect(await sweepLeaving(db, env, new Date(t0.getTime() + 92 * DAY))).toEqual({ checked: 1, reminded: 0, due: 0 });
    expect(await repos.control.organisationById(organisationId)).not.toBeNull();
  });

  it("reactivating clears the clock", async () => {
    const { db } = createTestDb();
    const { repos, organisationId } = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const t0 = new Date("2026-10-03T12:00:00Z");
    let o = (await repos.control.updateOrganisation(organisationId, { status: "suspended" }))!;
    await onOrganisationStatusChanged(db, env, o, "active", t0);
    o = (await repos.control.updateOrganisation(organisationId, { status: "active" }))!;
    const r = await onOrganisationStatusChanged(db, env, o, "suspended", new Date(t0.getTime() + DAY));
    expect(r.notified).toBe(false);
    expect(leavingDeadline((await repos.control.organisationById(organisationId))!)).toBeNull();
  });
});
