import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? ""), renderEmail: (s: string) => s }));
vi.mock("@/lib/push/fcm", () => ({ sendPush: vi.fn(async () => ({ sent: 0 })) }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import {
  availabilityHorizon,
  getCourseAvailabilityStates,
  getWeekAvailability,
  getWeekAvailabilityMatrix,
  loadInstructorAvailability,
  markLeaveBusy,
  setAvailability,
  setAvailabilityMany,
  setAvailabilityNote,
  setAvailabilityPattern,
} from "@/lib/services/availability";
import { assignStaff } from "@/lib/services/assignment";
import { decideLeave, requestLeave } from "@/lib/services/leave";
import { createCourseWithSessions } from "@/lib/services/courses";
import { addDaysIso, mondayOf } from "@/lib/domain/availability";
import type { Repositories } from "@/lib/db/repositories";
import type { SystemTenantContext } from "@/lib/tenant/context";
import type { Database as DrizzleDatabase } from "@/lib/db/client";

const MONDAY = "2026-01-05";

describe("availability service", () => {
  let db: DrizzleDatabase;
  let repos: Repositories;
  let ctx: SystemTenantContext;
  let instructorId: string;

  beforeEach(async () => {
    ({ db } = createTestDb());
    const seeded = await seedFullOrg(db, { name: "Alpha", slug: "alpha", jurisdiction: "england" });
    repos = seeded.repos;
    ctx = seeded.ctx;
    instructorId = (await repos.tenant.instructor.list(ctx))[0]!.id;
  });

  it("inserts, then updates the same slot in place: the database keeps one row per instructor, date and slot", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-06", "AM", "available");
    let week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("available");

    await setAvailability(repos, ctx, instructorId, "2026-01-06", "AM", "unavailable");
    week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("unavailable");

    const rows = await repos.tenant.availability.list(ctx);
    expect(rows.filter((r) => r.date === "2026-01-06" && r.slot === "AM")).toHaveLength(1);
    // Even a raw second insert for the same key is refused by the unique index.
    await expect(repos.tenant.availability.insert(ctx, { instructorId, date: "2026-01-06", weekday: null, slot: "AM", status: "available" })).rejects.toThrow();
  });

  it("clears a dated answer when status is null, and a batch writes many slots with one audit row", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-07", "PM", "tentative");
    await setAvailability(repos, ctx, instructorId, "2026-01-07", "PM", null);
    expect((await getWeekAvailability(repos, ctx, instructorId, MONDAY))["2026-01-07|PM"]).toBeUndefined();

    const before = (await repos.tenant.auditLog.list(ctx)).length;
    await setAvailabilityMany(repos, ctx, instructorId, [
      { date: "2026-01-06", slot: "AM", status: "available" },
      { date: "2026-01-06", slot: "PM", status: "available" },
      { date: "2026-01-06", slot: "EV", status: "unavailable" },
    ]);
    const week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("available");
    expect(week["2026-01-06|EV"]).toBe("unavailable");
    expect((await repos.tenant.auditLog.list(ctx)).length).toBe(before + 1);
  });

  it("the usual week and day notes are stored once per key and read back together", async () => {
    await setAvailabilityPattern(repos, ctx, instructorId, 2, "AM", "available"); // Tuesdays
    await setAvailabilityPattern(repos, ctx, instructorId, 2, "AM", "tentative");
    await setAvailabilityPattern(repos, ctx, instructorId, 6, "AM", null); // the fixture's Saturday pattern goes
    await setAvailabilityNote(repos, ctx, instructorId, "2026-01-06", "Back by 2pm");
    await setAvailabilityNote(repos, ctx, instructorId, "2026-01-06", "Back by 3pm");
    const { index, notes } = await loadInstructorAvailability(repos, ctx, instructorId);
    expect(index.pattern).toEqual({ "2|AM": "tentative" });
    expect(notes["2026-01-06"]).toBe("Back by 3pm");
    expect((await repos.tenant.availabilityNote.list(ctx)).filter((n) => n.date === "2026-01-06")).toHaveLength(1);
    await setAvailabilityNote(repos, ctx, instructorId, "2026-01-06", "");
    expect((await loadInstructorAvailability(repos, ctx, instructorId)).notes["2026-01-06"]).toBeUndefined();
    await expect(setAvailabilityPattern(repos, ctx, instructorId, 7, "AM", "available")).rejects.toThrow();
  });

  it("the office can answer for someone and it is recorded as set by the office", async () => {
    await setAvailability(repos, ctx, instructorId, "2026-01-08", "AM", "available", { setBy: "office" });
    const { setBy } = await loadInstructorAvailability(repos, ctx, instructorId);
    expect(setBy["2026-01-08|AM"]).toBe("office");
    const audit = await repos.tenant.auditLog.list(ctx);
    expect(audit.some((a) => a.action === "set_availability_office")).toBe(true);
  });

  it("approved leave writes Busy into every slot of every day it covers", async () => {
    const req = await requestLeave(repos, ctx, instructorId, { type: "annual", startDate: "2026-01-06", endDate: "2026-01-07", days: 2 });
    await decideLeave(repos, ctx, req.id, "approved");
    const week = await getWeekAvailability(repos, ctx, instructorId, MONDAY);
    expect(week["2026-01-06|AM"]).toBe("unavailable");
    expect(week["2026-01-07|EV"]).toBe("unavailable");
    expect(week["2026-01-08|AM"]).toBeUndefined();
    expect((await loadInstructorAvailability(repos, ctx, instructorId)).setBy["2026-01-06|PM"]).toBe("leave");
    expect(await markLeaveBusy(repos, ctx, instructorId, "2026-03-02", "2026-03-02")).toBe(3);
  });

  it("the office matrix shows the Busy default inside the window and 'not asked yet' beyond it", async () => {
    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    const h = availabilityHorizon(settings);
    const thisMonday = h.from;
    const nextMonday = addDaysIso(thisMonday, 7);
    const beyond = addDaysIso(h.to, 7);
    await repos.tenant.orgSettings.update(ctx, settings.id, { availabilityWeeksAhead: 2 });
    await setAvailability(repos, ctx, instructorId, nextMonday, "AM", "available");

    const now = await getWeekAvailabilityMatrix(repos, ctx, thisMonday);
    const me = now.rows.find((r) => r.instructorId === instructorId)!;
    expect(me.cells[`${thisMonday}|AM`]).toBe("unavailable");
    expect(me.sources[`${thisMonday}|AM`]).toBe("default");
    // The fixture gives this instructor Saturdays AM Free as a usual week.
    const saturday = addDaysIso(thisMonday, 5);
    expect(me.cells[`${saturday}|AM`]).toBe("available");
    expect(me.sources[`${saturday}|AM`]).toBe("pattern");
    expect(now.availableCounts[`${saturday}|AM`]).toBe(1);

    const next = await getWeekAvailabilityMatrix(repos, ctx, nextMonday);
    expect(next.rows.find((r) => r.instructorId === instructorId)!.sources[`${nextMonday}|AM`]).toBe("set");

    const far = await getWeekAvailabilityMatrix(repos, ctx, mondayOf(beyond));
    expect(far.rows.find((r) => r.instructorId === instructorId)!.cells[`${mondayOf(beyond)}|AM`]).toBe("unasked");
    expect(far.horizon.weeksAhead).toBe(2);
  });

  it("rostering is blocked by the Busy default inside the window, never beyond it, and the picker says why", async () => {
    const settings = (await repos.tenant.orgSettings.list(ctx))[0]!;
    await repos.tenant.orgSettings.update(ctx, settings.id, { requireParentApproval: false });
    const h = availabilityHorizon(settings);
    const courseTypeId = (await repos.tenant.courseType.list(ctx))[0]!.id;
    const roleId = (await repos.tenant.roleType.list(ctx))[0]!.id;
    const newcomer = await repos.tenant.instructor.insert(ctx, { name: "Nia", email: "nia@alpha.test", employmentType: "employed", status: "active" });

    const inside = addDaysIso(h.from, 2); // a Wednesday inside the window
    const outside = addDaysIso(h.to, 2); // the week after the window closes
    const { courseId: soon } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: inside, slot: "PM" }] });
    const { courseId: later } = await createCourseWithSessions(repos, ctx, { courseTypeId, sessions: [{ date: outside, slot: "PM" }] });

    const blocked = await assignStaff(repos, ctx, { courseId: soon, instructorId: newcomer.id, roleTypeId: roleId });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) { expect(blocked.reason).toBe("unavailable"); expect(blocked.detail).toMatch(/Hasn't marked .* as free yet/); }

    const states = await getCourseAvailabilityStates(repos, ctx);
    expect(states.get(soon)!.get(newcomer.id)).toBe("silent");
    expect(states.get(later)!.get(newcomer.id)).toBe("unset");

    const notAsked = await assignStaff(repos, ctx, { courseId: later, instructorId: newcomer.id, roleTypeId: roleId });
    expect(notAsked.ok).toBe(true);

    await setAvailability(repos, ctx, newcomer.id, inside, "PM", "available");
    expect((await getCourseAvailabilityStates(repos, ctx)).get(soon)!.get(newcomer.id)).toBe("available");
    const ok = await assignStaff(repos, ctx, { courseId: soon, instructorId: newcomer.id, roleTypeId: roleId });
    expect(ok.ok).toBe(true);
  });
});
