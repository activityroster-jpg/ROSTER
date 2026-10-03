import { describe, expect, it } from "vitest";
import { evaluateWorkingTime, schoolLeavingDate, selectBand, type Shift } from "@/lib/domain/working-time";
import { BUILTIN_PACKS, packKeyFor } from "@/lib/rules/working-time/packs";

const gb = BUILTIN_PACKS.gb!, ie = BUILTIN_PACKS.ie!;
// London summer time: 09:00 BST = 08:00Z
const at = (date: string, hStart: number, hEnd: number): Shift => ({ date, startAt: Date.parse(`${date}T${String(hStart - 1).padStart(2, "0")}:00:00Z`), endAt: Date.parse(`${date}T${String(hEnd - 1).padStart(2, "0")}:00:00Z`), proposed: true });
const codes = (f: ReturnType<typeof evaluateWorkingTime>) => f.filter((x) => x.severity === "block").map((x) => x.code);

describe("school-leaving and bands", () => {
  it("GB leaving date is the last Friday in June of the school year they turn 16", () => {
    expect(schoolLeavingDate("2010-03-10", "gb")).toBe("2026-06-26");
    expect(schoolLeavingDate("2010-10-10", "gb")).toBe("2027-06-25");
    expect(schoolLeavingDate("2010-10-10", "ni")).toBe("2027-06-30");
    expect(schoolLeavingDate("2010-10-10", "ie")).toBe("2026-10-10");
  });
  it("picks the child band before leaving and the young-worker band after", () => {
    // GB (decision): 16–17 rules apply from the 16th birthday, whatever the school-leaving date.
    expect(selectBand(gb, "2010-03-10", "2026-06-01")?.id).toBe("gb-young");
    expect(selectBand(gb, "2010-03-10", "2026-03-09")?.id).toBe("gb-child-15");
    expect(selectBand(gb, "2012-02-01", "2026-06-01")).toBeNull(); // 14: under the platform minimum, no band
    expect(selectBand(gb, "2010-03-10", "2026-07-01")?.id).toBe("gb-young");
    expect(selectBand(gb, "2005-01-01", "2026-07-01")).toBeNull();
    expect(selectBand(ie, "2011-05-05", "2026-07-01")?.id).toBe("ie-child");
  });
  it("maps jurisdictions to packs", () => {
    expect(packKeyFor("wales")).toBe("gb"); expect(packKeyFor("northern_ireland")).toBe("ni"); expect(packKeyFor("ireland")).toBe("ie"); expect(packKeyFor("other")).toBeNull();
  });
});

describe("GB school-age child in term time", () => {
  const term = [{ from: "2026-09-01", to: "2026-12-18" }];
  const dob = "2011-02-01"; // 15 in 2026, school-leaving June 2027
  it("blocks more than 2 hours on a school day and more than 12 a week", () => {
    const f = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: [], proposed: [at("2026-09-15", 16, 19)] });
    expect(codes(f)).toContain("daily-hours");
    const week = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: [at("2026-09-19", 9, 17)], proposed: [at("2026-09-20", 9, 11), at("2026-09-15", 16, 18), at("2026-09-16", 16, 18)] });
    expect(codes(week)).toContain("weekly-hours");
  });
  it("allows 8 hours on a Saturday and blocks early starts and late finishes", () => {
    const ok = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: [], proposed: [at("2026-09-19", 9, 17)] });
    expect(codes(ok)).toEqual([]);
    const early = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: [], proposed: [at("2026-09-19", 6, 8)] });
    expect(codes(early)).toContain("early-start");
    const late = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: [], proposed: [at("2026-09-19", 17, 20)] });
    expect(codes(late)).toContain("late-finish");
  });
  it("holiday weeks use the holiday caps", () => {
    const four = [at("2026-08-10", 9, 17), at("2026-08-11", 9, 17), at("2026-08-12", 9, 17), at("2026-08-13", 9, 17)];
    // 8+8+8+8+3 = 35 hours: exactly the holiday weekly cap, so no finding
    const ok = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: four, proposed: [at("2026-08-14", 9, 12)] });
    expect(codes(ok)).toEqual([]);
    // 8+8+8+8+4 = 36 hours: one over the cap
    const over = evaluateWorkingTime({ pack: gb, dateOfBirth: dob, employmentType: "employed", termRanges: term, existing: four, proposed: [at("2026-08-14", 9, 13)] });
    expect(codes(over)).toEqual(["weekly-hours"]);
  });
  it("under-15s get no caps, only a notice (warning if recorded as employed)", () => {
    const young = "2012-02-01"; // 14 in 2026
    const employed = evaluateWorkingTime({ pack: gb, dateOfBirth: young, employmentType: "employed", termRanges: term, existing: [], proposed: [at("2026-08-10", 9, 15)] });
    expect(codes(employed)).toEqual([]); // nothing blocks
    expect(employed.map((f) => f.code)).toEqual(["under-minimum-age"]);
    expect(employed[0]?.severity).toBe("warn");
    const volunteer = evaluateWorkingTime({ pack: gb, dateOfBirth: young, employmentType: "volunteer", termRanges: term, existing: [], proposed: [at("2026-08-10", 9, 15)] });
    expect(volunteer[0]?.severity).toBe("info");
    expect(gb.verified).toBe(true);
    expect(gb.bands.every((b) => b.unverified.length === 0)).toBe(true);
  });
});

describe("Ireland", () => {
  it("16–17: 8 a day, 40 a week, 12 hours' daily rest, 2 days off in 7", () => {
    const dob = "2009-05-01";
    const f = evaluateWorkingTime({ pack: ie, dateOfBirth: dob, employmentType: "employed", termRanges: [], existing: [at("2026-07-06", 9, 18)], proposed: [at("2026-07-07", 9, 18)] });
    expect(codes(f)).toContain("daily-hours");
    const rest = evaluateWorkingTime({ pack: ie, dateOfBirth: dob, employmentType: "employed", termRanges: [], existing: [at("2026-07-06", 14, 22)], proposed: [at("2026-07-07", 7, 12)] });
    expect(codes(rest)).toContain("daily-rest");
    const days = evaluateWorkingTime({ pack: ie, dateOfBirth: dob, employmentType: "employed", termRanges: [], existing: ["06", "07", "08", "09", "10"].map((d) => at(`2026-07-${d}`, 9, 13)), proposed: [at("2026-07-11", 9, 13)] });
    expect(codes(days)).toContain("weekly-rest");
  });
  it("adults and people without a date of birth get no breaches", () => {
    expect(codes(evaluateWorkingTime({ pack: ie, dateOfBirth: "1990-01-01", employmentType: "employed", termRanges: [], existing: [], proposed: [at("2026-07-07", 6, 23)] }))).toEqual([]);
    const none = evaluateWorkingTime({ pack: ie, dateOfBirth: null, employmentType: "employed", termRanges: [], existing: [], proposed: [at("2026-07-07", 6, 23)] });
    expect(none[0]?.code).toBe("no-dob");
    expect(evaluateWorkingTime({ pack: null, dateOfBirth: "2010-01-01", employmentType: "employed", termRanges: [], existing: [], proposed: [] })[0]?.code).toBe("no-pack");
  });
});
