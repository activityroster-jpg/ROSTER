import { describe, expect, it } from "vitest";
import { prospectStatusRank } from "@/lib/marketing";

describe("prospectStatusRank", () => {
  it("ranks a prospect by its most advanced status", () => {
    expect(prospectStatusRank(["new"])).toBe(0);
    expect(prospectStatusRank([])).toBe(0);
    expect(prospectStatusRank(["email_sent"])).toBe(1);
    expect(prospectStatusRank(["ready_to_send", "email_sent"])).toBe(4);
    expect(prospectStatusRank(["called", "letter_sent"])).toBe(5);
    expect(prospectStatusRank(["letter_sent", "booklet_sent"])).toBe(7);
    expect(prospectStatusRank(["purchased"])).toBe(8);
    expect(prospectStatusRank(["purchased", "rejected"])).toBe(9);
  });

  it("orders nothing before printed before posted before signed up", () => {
    const ranks = [["purchased"], ["new"], ["letter_sent"], ["ready_to_send"]].map((s) => prospectStatusRank(s as never));
    expect([...ranks].sort((a, b) => a - b)).toEqual([0, 4, 5, 8]);
  });
});
