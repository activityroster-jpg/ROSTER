import { describe, it, expect } from "vitest";
import { parseCsv, autoDetectStaffColumns, draftsStaffFromCsv, normaliseEmployment, splitList } from "@/lib/import/staff";

describe("staff import parsing", () => {
  const csv = `Name,Email,Type,Tickets,Can teach\nSam Jones,sam@club.org,Freelance,"Dinghy Instructor; First Aid","Youth Stage 1, Start Sailing"\n,,,,\nAlex Lee,not-an-email,casual,Powerboat,`;

  it("auto-detects columns from the header", () => {
    const grid = parseCsv(csv);
    const map = autoDetectStaffColumns(grid[0]!);
    expect(map.name).toBe(0);
    expect(map.email).toBe(1);
    expect(map.employment).toBe(2);
    expect(map.quals).toBe(3);
    expect(map.courses).toBe(4);
  });

  it("builds tolerant drafts, skipping blank lines and flagging issues", () => {
    const grid = parseCsv(csv);
    const drafts = draftsStaffFromCsv(grid, autoDetectStaffColumns(grid[0]!), true);
    expect(drafts).toHaveLength(2); // blank row dropped
    expect(drafts[0]!.name).toBe("Sam Jones");
    expect(drafts[0]!.employment).toBe("freelance");
    expect(drafts[1]!.issues.some((i) => /invalid/i.test(i))).toBe(true); // bad email flagged
    expect(drafts[1]!.employment).toBe("freelance"); // "casual" → freelance
  });

  it("splits free-text lists on commas/semicolons", () => {
    expect(splitList("Dinghy Instructor; First Aid, Powerboat")).toEqual(["Dinghy Instructor", "First Aid", "Powerboat"]);
    expect(splitList("")).toEqual([]);
  });

  it("normalises employment loosely", () => {
    expect(normaliseEmployment("Volunteer")).toBe("volunteer");
    expect(normaliseEmployment("self-employed")).toBe("freelance");
    expect(normaliseEmployment("PAYE")).toBe("employed");
    expect(normaliseEmployment("")).toBe("employed");
  });
});
