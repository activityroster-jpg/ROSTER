import { describe, expect, it } from "vitest";
import { prospectStatusRank } from "@/lib/marketing";

describe("prospectStatusRank", () => {
  it("ranks a prospect by its most advanced status", () => {
    expect(prospectStatusRank(["new"])).toBe(0);
    expect(prospectStatusRank([])).toBe(0);
    expect(prospectStatusRank(["letter_sent"])).toBe(1);
    expect(prospectStatusRank(["letter_sent", "email_sent"])).toBe(2);
    expect(prospectStatusRank(["called", "letter_sent"])).toBe(4);
    expect(prospectStatusRank(["purchased"])).toBe(5);
  });

  it("orders new before lettered before purchased", () => {
    const ranks = [["purchased"], ["new"], ["letter_sent"]].map((s) => prospectStatusRank(s as never));
    expect([...ranks].sort((a, b) => a - b)).toEqual([0, 1, 5]);
  });
});
