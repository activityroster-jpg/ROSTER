import { describe, expect, it } from "vitest";
import { groupLetterBatches } from "@/lib/marketing/letter-batches";

const at = (iso: string) => new Date(iso);

describe("groupLetterBatches", () => {
  it("rebuilds batches from the log, newest first, centres in print order", () => {
    const rows = [
      { prospectId: "c", author: "conor", createdAt: at("2026-10-10T10:00:00.003Z") },
      { prospectId: "a", author: "conor", createdAt: at("2026-10-10T10:00:00.001Z") },
      { prospectId: "b", author: "conor", createdAt: at("2026-10-10T10:00:00.002Z") },
      { prospectId: "d", author: "conor", createdAt: at("2026-10-10T14:30:00.000Z") },
      { prospectId: "e", author: "conor", createdAt: at("2026-10-10T14:30:00.400Z") },
    ];
    const batches = groupLetterBatches(rows);
    expect(batches.map((b) => b.prospectIds)).toEqual([["d", "e"], ["a", "b", "c"]]);
    expect(batches[1]!.printedAt.toISOString()).toBe("2026-10-10T10:00:00.001Z");
  });

  it("splits two batches printed a few minutes apart, and keeps people apart", () => {
    const rows = [
      { prospectId: "a", author: "conor", createdAt: at("2026-10-10T10:00:00Z") },
      { prospectId: "b", author: "conor", createdAt: at("2026-10-10T10:03:00Z") },
      { prospectId: "c", author: "other", createdAt: at("2026-10-10T10:03:00Z") },
    ];
    expect(groupLetterBatches(rows).map((b) => b.prospectIds)).toEqual([["c"], ["b"], ["a"]]);
  });

  it("starts a new batch when the same centre appears again straight away", () => {
    const rows = [
      { prospectId: "a", author: "conor", createdAt: at("2026-10-10T10:00:00Z") },
      { prospectId: "a", author: "conor", createdAt: at("2026-10-10T10:00:05Z") },
    ];
    expect(groupLetterBatches(rows)).toHaveLength(2);
  });

  it("handles no history", () => expect(groupLetterBatches([])).toEqual([]));
});
