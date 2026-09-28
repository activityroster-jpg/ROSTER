import { describe, it, expect } from "vitest";
import {
  autoDetectColumns,
  draftsFromCsv,
  draftsFromIcs,
  normaliseAudience,
  normaliseDate,
  normaliseTime,
  parseCsv,
  timeToSlot,
  toEpochMs,
} from "@/lib/import/parse";

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    const grid = parseCsv('a,b,c\r\n"x,y",z,"he said ""hi"""\n');
    expect(grid).toEqual([
      ["a", "b", "c"],
      ["x,y", "z", 'he said "hi"'],
    ]);
  });
  it("drops fully-blank rows", () => {
    expect(parseCsv("a,b\n\n,\nx,y")).toEqual([["a", "b"], ["x", "y"]]);
  });
});

describe("normaliseDate", () => {
  it("passes ISO through", () => expect(normaliseDate("2026-07-12")).toBe("2026-07-12"));
  it("reads UK DD/MM/YYYY", () => expect(normaliseDate("12/07/2026")).toBe("2026-07-12"));
  it("reads 2-digit years and dashes", () => expect(normaliseDate("1-2-26")).toBe("2026-02-01"));
  it("reads '12 Jul 2026'", () => expect(normaliseDate("12 Jul 2026")).toBe("2026-07-12"));
  it("rejects nonsense and impossible months", () => {
    expect(normaliseDate("not a date")).toBe("");
    expect(normaliseDate("12/13/2026")).toBe("");
  });
});

describe("normaliseTime", () => {
  it("reads 24h and am/pm", () => {
    expect(normaliseTime("9:30")).toBe("09:30");
    expect(normaliseTime("1pm")).toBe("13:00");
    expect(normaliseTime("12am")).toBe("00:00");
    expect(normaliseTime("0930")).toBe("09:30");
  });
  it("rejects rubbish", () => expect(normaliseTime("later")).toBe(""));
});

describe("normaliseAudience", () => {
  it("spots youth/adult cues in value or name", () => {
    expect(normaliseAudience("", "Junior Stage 1")).toBe("youth");
    expect(normaliseAudience("Adults", "")).toBe("adult");
    expect(normaliseAudience("", "Improving Skills")).toBe("all");
  });
});

describe("autoDetectColumns", () => {
  it("maps common header names", () => {
    const m = autoDetectColumns(["Course", "Date", "Start", "End", "Instructor", "Venue"]);
    expect(m.name).toBe(0);
    expect(m.date).toBe(1);
    expect(m.startTime).toBe(2);
    expect(m.endTime).toBe(3);
    expect(m.staff).toBe(4);
    expect(m.location).toBe(5);
  });
});

describe("draftsFromCsv", () => {
  it("builds rows and flags unclear ones", () => {
    const grid = parseCsv("Course,Date,Start,End\nStage 1,12/07/2026,09:30,12:30\n,bad,,");
    const mapping = autoDetectColumns(grid[0]!);
    const rows = draftsFromCsv(grid, mapping, true);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe("Stage 1");
    expect(rows[0]!.date).toBe("2026-07-12");
    expect(rows[0]!.audience).toBe("all"); // no youth/adult cue in "Stage 1"
    expect(rows[0]!.issues).toEqual([]);
    expect(rows[1]!.issues.length).toBeGreaterThan(0);
  });
});

describe("draftsFromIcs", () => {
  it("reads VEVENTs", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "SUMMARY:Junior Club",
      "DTSTART:20260712T093000Z",
      "DTEND:20260712T123000Z",
      "LOCATION:Main Lake",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const rows = draftsFromIcs(ics);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Junior Club");
    expect(rows[0]!.date).toBe("2026-07-12");
    expect(rows[0]!.startTime).toBe("09:30");
    expect(rows[0]!.location).toBe("Main Lake");
    expect(rows[0]!.audience).toBe("youth");
  });
});

describe("timeToSlot / toEpochMs", () => {
  it("buckets times into slots", () => {
    expect(timeToSlot("09:00")).toBe("AM");
    expect(timeToSlot("13:00")).toBe("PM");
    expect(timeToSlot("18:00")).toBe("EV");
  });
  it("produces a UTC epoch", () => {
    expect(toEpochMs("2026-07-12", "09:30")).toBe(Date.UTC(2026, 6, 12, 9, 30));
  });
});
