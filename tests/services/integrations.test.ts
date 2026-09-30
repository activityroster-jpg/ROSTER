import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { syncIcsFeed } from "@/lib/services/integrations";

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
