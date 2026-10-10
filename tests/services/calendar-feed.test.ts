import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { buildIcs, icsEscape, icsFloating, icsFold } from "@/lib/domain/ics";
import { calendarFeedFor, issueCalendarToken, resolveCalendarToken, revokeCalendarToken } from "@/lib/services/calendar-feed";
import { publishWeek } from "@/lib/services/roster";
import { createCourseWithSessions } from "@/lib/services/courses";
import { assignStaff } from "@/lib/services/assignment";
import { setAvailability } from "@/lib/services/availability";

describe("ICS writer", () => {
  it("writes floating wall-clock times, escapes text and folds long lines", () => {
    expect(icsFloating(Date.UTC(2027, 6, 3, 9, 30))).toBe("20270703T093000");
    expect(icsEscape("Stage 1; Lake, North\\n")).toBe("Stage 1\; Lake\\, North\\\\n");
    const long = "DESCRIPTION:" + "x".repeat(200);
    expect(icsFold(long).split("\r\n").every((l, i) => (i === 0 ? l.length <= 75 : l.startsWith(" ") && l.length <= 75))).toBe(true);
    const ics = buildIcs("Alpha roster", [{ uid: "s1@activityroster", startAt: Date.UTC(2027, 6, 3, 9), endAt: Date.UTC(2027, 6, 3, 12), summary: "Stage 1 (Instructor)", location: "Lake" }], Date.UTC(2026, 9, 4));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20270703T090000\r\n");
    expect(ics).toContain("DTSTAMP:20261004T000000Z\r\n");
    expect(ics).not.toMatch(/DTSTART:[0-9T]+Z/);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("calendar feed", () => {
  it("issues a link shown once, resolves it inside its own centre only, lists published shifts, and revokes", async () => {
    const { db } = createTestDb();
    const a = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    const b = await seedFullOrg(db, { name: "Bravo", slug: "bravo", jurisdiction: "england" });
    const { repos, ctx } = a;
    const st = (await repos.tenant.orgSettings.list(ctx))[0]!;
    const me = (await repos.tenant.instructor.list(ctx))[0]!;
    const roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 14);
    const day = d.toISOString().slice(0, 10);
    const { courseId } = await createCourseWithSessions(repos, ctx, { name: "Summer Stage 2", courseTypeId, sessions: [{ date: day, slot: "AM", startTime: "09:30", endTime: "12:15" }] });
    await setAvailability(repos, ctx, me.id, day, "AM", "available");
    expect((await assignStaff(repos, ctx, { courseId, instructorId: me.id, roleTypeId: roleId })).ok).toBe(true);

    const token = await issueCalendarToken(repos, ctx, me.id);
    expect(token).toMatch(new RegExp(`^${ctx.organisationId}\\.[A-Za-z0-9_-]{32}$`));
    const stored = (await repos.tenant.instructor.findById(ctx, me.id))!;
    expect(stored.calendarTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.calendarTokenHash).not.toContain(token!.split(".")[1]);

    const who = await resolveCalendarToken(repos, token!);
    expect(who?.instructorId).toBe(me.id);
    // Another centre's id with this secret finds nobody; a tampered secret finds nobody.
    expect(await resolveCalendarToken(repos, `${b.ctx.organisationId}.${token!.split(".")[1]}`)).toBeNull();
    expect(await resolveCalendarToken(repos, `${ctx.organisationId}.${"A".repeat(32)}`)).toBeNull();
    expect(await resolveCalendarToken(repos, "nonsense")).toBeNull();

    // Draft week: nothing yet. Published: the shift, as typed.
    let ics = await calendarFeedFor(repos, ctx, me.id, "Alpha");
    expect(ics).not.toContain("Summer Stage 2");
    await publishWeek(repos, ctx, day);
    ics = await calendarFeedFor(repos, ctx, me.id, "Alpha");
    expect(ics).toContain("Summer Stage 2");
    expect(ics).toContain(`DTSTART:${day.replace(/-/g, "")}T093000`);
    expect(ics).toContain(`DTEND:${day.replace(/-/g, "")}T121500`);

    // A new link replaces the old; turning it off stops both.
    const next = await issueCalendarToken(repos, ctx, me.id);
    expect(await resolveCalendarToken(repos, token!)).toBeNull();
    expect((await resolveCalendarToken(repos, next!))?.instructorId).toBe(me.id);
    expect(await revokeCalendarToken(repos, ctx, me.id)).toBe(true);
    expect(await resolveCalendarToken(repos, next!)).toBeNull();
  });
});
