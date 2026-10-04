import { describe, expect, it } from "vitest";
import { courseAvailState, describeBusy, effectiveAvailability, horizonFor, indexAvailability, inHorizon, weekdayOf } from "@/lib/domain/availability";

// Monday 5 January 2026. A four-week window runs to (not including) 2 February.
const H = horizonFor("2026-01-07", 4);

describe("availability has no blank", () => {
  it("the window starts on this week's Monday and runs the configured weeks (1–26, default 4)", () => {
    expect(H).toEqual({ from: "2026-01-05", to: "2026-02-02", weeksAhead: 4 });
    expect(horizonFor("2026-01-11", 1).from).toBe("2026-01-05"); // a Sunday still belongs to the week that started Monday
    expect(horizonFor("2026-01-07", 0).weeksAhead).toBe(4);
    expect(horizonFor("2026-01-07", 99).weeksAhead).toBe(26);
    expect(inHorizon(H, "2026-02-01")).toBe(true);
    expect(inHorizon(H, "2026-02-02")).toBe(false);
    expect(inHorizon(H, "2026-01-04")).toBe(false);
  });

  it("a dated answer beats the usual week, which beats the Busy default; beyond the window nobody has been asked", () => {
    const idx = indexAvailability([
      { date: "2026-01-06", weekday: null, slot: "AM", status: "available" },
      { date: null, weekday: weekdayOf("2026-01-06"), slot: "PM", status: "tentative" }, // Tuesdays PM usually Maybe
      { date: null, weekday: 6, slot: "AM", status: "available" }, // Saturdays AM usually Free
      { date: "2026-01-10", weekday: null, slot: "AM", status: "unavailable" }, // but not this Saturday
    ]);
    expect(effectiveAvailability(idx, H, "2026-01-06", "AM")).toEqual({ status: "available", source: "set" });
    expect(effectiveAvailability(idx, H, "2026-01-06", "PM")).toEqual({ status: "tentative", source: "pattern" });
    expect(effectiveAvailability(idx, H, "2026-01-13", "PM")).toEqual({ status: "tentative", source: "pattern" });
    expect(effectiveAvailability(idx, H, "2026-01-06", "EV")).toEqual({ status: "unavailable", source: "default" });
    expect(effectiveAvailability(idx, H, "2026-01-10", "AM")).toEqual({ status: "unavailable", source: "set" });
    expect(effectiveAvailability(idx, H, "2026-01-17", "AM")).toEqual({ status: "available", source: "pattern" });
    // Beyond the window: the usual week still answers, anything else is unasked.
    expect(effectiveAvailability(idx, H, "2026-02-07", "AM")).toEqual({ status: "available", source: "pattern" });
    expect(effectiveAvailability(idx, H, "2026-02-03", "AM")).toEqual({ status: "unasked", source: "unasked" });
    expect(effectiveAvailability(idx, H, "2025-12-30", "AM")).toEqual({ status: "unasked", source: "unasked" });
  });

  it("explains why a slot is busy in plain English", () => {
    expect(describeBusy({ status: "unavailable", source: "set" }, "2026-01-06", "AM")).toBe("Marked busy on 2026-01-06 AM");
    expect(describeBusy({ status: "unavailable", source: "pattern" }, "2026-01-06", "AM")).toMatch(/Usually busy on Tuesdays AM/);
    expect(describeBusy({ status: "unavailable", source: "default" }, "2026-01-06", "AM")).toMatch(/Hasn't marked 2026-01-06 AM as free yet/);
  });

  it("summarises an instructor against a course's slots for the picker", () => {
    const idx = indexAvailability([
      { date: "2026-01-06", weekday: null, slot: "AM", status: "available" },
      { date: "2026-01-07", weekday: null, slot: "AM", status: "tentative" },
      { date: "2026-01-08", weekday: null, slot: "AM", status: "unavailable" },
    ]);
    expect(courseAvailState(idx, H, [])).toBe("none");
    expect(courseAvailState(idx, H, ["2026-01-06|AM"])).toBe("available");
    expect(courseAvailState(idx, H, ["2026-01-06|AM", "2026-01-07|AM"])).toBe("partial");
    expect(courseAvailState(idx, H, ["2026-01-06|AM", "2026-01-08|AM"])).toBe("unavailable");
    expect(courseAvailState(idx, H, ["2026-01-06|AM", "2026-01-09|AM"])).toBe("silent"); // one slot never answered inside the window
    expect(courseAvailState(idx, H, ["2026-02-10|AM"])).toBe("unset"); // beyond the window
    expect(courseAvailState(idx, H, ["2026-01-06|AM", "2026-02-10|AM"])).toBe("partial"); // free where asked, not yet asked for the rest
  });
});
