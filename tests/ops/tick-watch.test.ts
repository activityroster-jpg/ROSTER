import { describe, expect, it } from "vitest";
import { TICK_OVERDUE_MS, tickOverdue } from "@/lib/ops/tick-watch";

describe("hourly job watchdog", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("alerts once the last tick is over two hours old, and only once per outage", () => {
    expect(tickOverdue(new Date(now.getTime() - TICK_OVERDUE_MS + 60_000), false, now)).toBe(false);
    expect(tickOverdue(new Date(now.getTime() - TICK_OVERDUE_MS - 60_000), false, now)).toBe(true);
    expect(tickOverdue(new Date(now.getTime() - TICK_OVERDUE_MS - 60_000), true, now)).toBe(false);
  });
  it("says nothing before the first tick has ever been recorded", () => {
    expect(tickOverdue(null, false, now)).toBe(false);
  });
});
