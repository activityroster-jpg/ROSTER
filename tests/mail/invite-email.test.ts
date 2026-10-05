import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; html: string }) => { sent.push(m); }),
  escapeHtml: (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
}));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { inviteEmail, inviteReminderEmail } from "@/lib/mail/invite-email";
import { sweepInviteReminders } from "@/lib/services/invite-reminders";
import { invitedAgo } from "@/components/office/InviteInstructorButton";
import type { Database } from "@/lib/db/client";
import type { Repositories } from "@/lib/db/repositories";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const DAY = 86_400_000;

describe("the invitation email", () => {
  it("names the centre and who invited them, gives three steps and the expired-link way in", () => {
    const e = inviteEmail({ kind: "instructor", centreName: "Yeadon <SC>", inviterName: "Ellie", url: "https://yeadon.activityroster.com/api/auth/magic?token=x", signInUrl: "https://yeadon.activityroster.com/sign-in?next=/portal&email=sam%40x.org", email: "sam@x.org" });
    expect(e.subject).toBe("Ellie at Yeadon <SC> has invited you to ActivityRoster");
    expect(e.html).toContain("Yeadon &lt;SC&gt;");
    expect(e.html).toContain("magic?token=x");
    expect(e.html).toContain("Mark the days you");
    expect(e.html).toContain("Email me a sign-in link");
    const r = inviteReminderEmail({ kind: "office", centreName: "Yeadon", inviterName: null, signInUrl: "https://yeadon.activityroster.com/sign-in", email: "jo@x.org" });
    expect(r.subject).toBe("Reminder: Yeadon invited you to ActivityRoster");
    expect(r.html).not.toContain("token");
  });

  it("says how long an invite has waited", () => {
    const now = Date.UTC(2026, 9, 5, 12);
    expect(invitedAgo(now - 3600_000, now)).toBe("today");
    expect(invitedAgo(now - DAY - 1, now)).toBe("yesterday");
    expect(invitedAgo(now - 3 * DAY, now)).toBe("3 days ago");
  });
});

describe("the one-day invite reminder", () => {
  let db: Database;
  let repos: Repositories;
  let orgId: string;

  beforeEach(async () => {
    sent.length = 0;
    const t = createTestDb();
    db = t.db as unknown as Database;
    const seeded = await seedFullOrg(db, { name: "Yeadon", slug: "yeadon", jurisdiction: "england" });
    repos = seeded.repos;
    orgId = seeded.organisationId;
  });

  it("goes once, a day after the invite, only while they haven't signed in; a re-send restarts it", async () => {
    const u = await repos.control.createUser({ name: "Sam", email: "sam@x.org" });
    await repos.control.createMembership({ userId: u.id, organisationId: orgId, role: "instructor" }, "invited");
    await repos.control.noteInviteSent(u.id, orgId, "Ellie");
    const env = { APP_APEX_DOMAIN: "activityroster.com" } as unknown as CloudflareEnv;

    expect(await sweepInviteReminders(db, env, new Date(Date.now() + 2 * 3600_000))).toEqual({ due: 0, sent: 0 });
    expect(await sweepInviteReminders(db, env, new Date(Date.now() + DAY + 60_000))).toEqual({ due: 1, sent: 1 });
    expect(sent[0]!.to).toBe("sam@x.org");
    expect(sent[0]!.subject).toBe("Reminder: Ellie at Yeadon invited you to ActivityRoster");
    expect(sent[0]!.html).toContain("https://yeadon.activityroster.com/sign-in?next=/portal&email=sam%40x.org");
    expect(await sweepInviteReminders(db, env, new Date(Date.now() + 3 * DAY))).toEqual({ due: 0, sent: 0 });

    // Re-send: one more reminder a day after that; none once they've signed in.
    await repos.control.noteInviteSent(u.id, orgId, "Ellie");
    await repos.control.acceptInvitedMembership(u.id, orgId);
    expect(await sweepInviteReminders(db, env, new Date(Date.now() + 3 * DAY))).toEqual({ due: 0, sent: 0 });
  });
});
