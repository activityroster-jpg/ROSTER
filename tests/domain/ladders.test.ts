import { describe, expect, it } from "vitest";
import { groupByLadder, ladderGroup } from "@/lib/domain/ladders";
import { DEFAULT_GRADES } from "@/lib/seed/catalogue";

describe("instructor types grouped by ladder", () => {
  it("puts the ladders in a fixed order, lowest rank first, certificates last", () => {
    const groups = groupByLadder(DEFAULT_GRADES.map((g) => ({ ...g, discipline: g.discipline ?? null })));
    expect(groups[0]!.label).toBe("Dinghy and multihull");
    expect(groups[0]!.types.map((t) => t.code).slice(0, 2)).toEqual(["AI", "DI"]);
    expect(groups.at(-1)!.label).toBe("Certificates and examiners");
    expect(groups.at(-1)!.types.map((t) => t.code)).toEqual(["PB2", "SBC", "CEND", "YME"]);
    // Every default type lands in exactly one group.
    expect(groups.reduce((n, g) => n + g.types.length, 0)).toBe(DEFAULT_GRADES.length);
  });

  it("names a ladder it doesn't know after itself", () => {
    expect(ladderGroup("kite_surf")).toEqual({ key: "kite_surf", label: "Kite surf" });
    expect(ladderGroup(null).label).toBe("Certificates and examiners");
    expect(ladderGroup("src").label).toBe("Shorebased");
  });
});
