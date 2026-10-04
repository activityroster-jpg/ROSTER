import { describe, expect, it } from "vitest";
import { describeAudit } from "@/lib/services/changelog";

describe("change-log sentences", () => {
  it("turns action + entity into plain English with the name when known", () => {
    expect(describeAudit("assign_staff", "course_staff", JSON.stringify({ name: "Sam" }))).toBe("Rostered an instructor on a course “Sam”");
    expect(describeAudit("publish_week", "roster_week", JSON.stringify({ weekStart: "2026-01-05" }))).toBe("Published the rota for the week “week of 2026-01-05”");
    expect(describeAudit("update_status", "course", JSON.stringify({ status: "confirmed" }))).toBe("Changed the status of a course to confirmed");
  });

  it("verbs that already name their object do not repeat it", () => {
    expect(describeAudit("clock_in", "time_entry")).toBe("Clocked in");
    expect(describeAudit("restore_defaults", "course_type", JSON.stringify({ restored: 3, added: 0 }))).toBe("Restored the RYA course list");
  });

  it("unknown actions still read as words, never as snake_case", () => {
    expect(describeAudit("frobnicate_widget", "equipment_type")).toBe("frobnicate widget — an equipment type");
    expect(describeAudit("import_courses", "course", JSON.stringify({ created: 12, skipped: 2 }))).toBe("Imported courses (12 added, 2 skipped)");
  });
});
