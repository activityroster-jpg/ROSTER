import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { syncIcsFeed, importDrafts, diffFeed, applyChanges } from "@/lib/services/integrations";
import { draftsFromIcs } from "@/lib/import/parse";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Youth Stage 1
DTSTART:20990615T090000Z
DTEND:20990615T120000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Adult Start Sailing
DTSTART:20990616T130000Z
DTEND:20990616T160000Z
END:VEVENT
END:VCALENDAR`;

describe("syncIcsFeed", () => {
  it("creates courses + sessions from an ICS feed and is idempotent on re-sync", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Feed", slug: "feed", jurisdiction: "england" });

    const first = await syncIcsFeed(repos, ctx, ICS);
    expect(first.created).toBe(2);
    expect(first.duplicates).toBe(0);

    const sessions = await repos.tenant.courseSession.list(ctx);
    // The two future events should now exist as sessions.
    expect(sessions.some((s) => s.date === "2099-06-15")).toBe(true);
    expect(sessions.some((s) => s.date === "2099-06-16")).toBe(true);

    // Re-syncing the same feed must not duplicate.
    const second = await syncIcsFeed(repos, ctx, ICS);
    expect(second.created).toBe(0);
    expect(second.duplicates).toBe(2);
  });

  it("diffs a changed feed and applies only what's selected (never auto-deletes)", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Diff", slug: "diff", jurisdiction: "england" });
    const SRC = "integration:test";
    const feed1 = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Course A
DTSTART:20990601T090000Z
DTEND:20990601T120000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Course B
DTSTART:20990602T090000Z
DTEND:20990602T120000Z
END:VEVENT
END:VCALENDAR`;
    await importDrafts(repos, ctx, draftsFromIcs(feed1), { source: SRC });

    // Feed now drops B and adds C; A unchanged.
    const feed2 = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Course A
DTSTART:20990601T090000Z
DTEND:20990601T120000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Course C
DTSTART:20990603T090000Z
DTEND:20990603T120000Z
END:VEVENT
END:VCALENDAR`;
    const diff = await diffFeed(repos, ctx, draftsFromIcs(feed2), SRC);
    expect(diff.toAdd.map((a) => a.name)).toEqual(["Course C"]);
    expect(diff.toRemove.map((r) => r.name)).toEqual(["Course B"]);

    // Apply: add C, but DON'T remove B (leave removeCourseIds empty) — B must survive.
    const applied = await applyChanges(repos, ctx, draftsFromIcs(feed2), SRC, diff.toAdd.map((a) => a.key), []);
    expect(applied.added).toBe(1);
    expect(applied.removed).toBe(0);
    const names = (await repos.tenant.course.list(ctx)).map((c) => c.name);
    expect(names).toContain("Course B"); // not auto-deleted
    expect(names).toContain("Course C");

    // Now explicitly remove B.
    const diff2 = await diffFeed(repos, ctx, draftsFromIcs(feed2), SRC);
    const removed = await applyChanges(repos, ctx, draftsFromIcs(feed2), SRC, [], diff2.toRemove.map((r) => r.courseId));
    expect(removed.removed).toBe(1);
    expect((await repos.tenant.course.list(ctx)).map((c) => c.name)).not.toContain("Course B");
  });

  it("skips past-dated events", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Past", slug: "past", jurisdiction: "england" });
    const past = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Old Course
DTSTART:20200101T090000Z
DTEND:20200101T120000Z
END:VEVENT
END:VCALENDAR`;
    const res = await syncIcsFeed(repos, ctx, past);
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
  });
});
