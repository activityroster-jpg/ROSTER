import { describe, expect, it } from "vitest";
import { isNoAction, letterPrinted, parseProspectStatuses, sizeScore, toggleOutreach, topRanks } from "@/lib/marketing";

describe("outreach tickboxes", () => {
  it("several can be ticked; No action is ticked when none are, and clears them", () => {
    let s = toggleOutreach([], "booklet_sent", true);
    s = toggleOutreach(s, "email_sent", true);
    expect(s.sort()).toEqual(["booklet_sent", "email_sent"]);
    expect(isNoAction(s)).toBe(false);
    expect(toggleOutreach(s, "email_sent", false)).toEqual(["booklet_sent"]);
    // No action clears the step ticks; LinkedIn contact and the older letter tick are left as they were.
    const cleared = toggleOutreach(["linkedin_contacted", "called", "booklet_sent"], null, true);
    expect(cleared).toEqual(["linkedin_contacted"]);
    expect(isNoAction(cleared)).toBe(true);
  });

  it("a stored \"new\" means nothing ticked; printed means Ready to send or Letter sent", () => {
    expect(parseProspectStatuses('["new"]', "new")).toEqual([]);
    expect(parseProspectStatuses(null, "letter_sent")).toEqual(["letter_sent"]);
    expect(letterPrinted(["ready_to_send"])).toBe(true);
    expect(letterPrinted(["flyer_sent"])).toBe(false);
  });
});

describe("top 250 by estimated size", () => {
  const p = (id: string, name: string, services: string, extra: Partial<{ region: string; topPick: boolean | null; website: string }> = {}) => ({ id, name, notes: `Services: ${services}. Tel 0`, ...extra });
  it("ranks by the RYA services run, Royal and yacht clubs a little higher", () => {
    expect(sizeScore(p("a", "Big Royal Yacht Club", "Training Centre, Club, ICCTestCentre"))).toBeGreaterThan(sizeScore(p("b", "Small Sailing Club", "Club")));
  });
  it("skips overseas centres, honours pins in and out, and stops at the limit", () => {
    const list = [
      p("1", "Alpha Yacht Club", "Training Centre, Club, ICCTestCentre, OnBoard Club"),
      p("2", "Beta Sailing Club", "Club"),
      p("3", "Gamma Sailing", "Training Centre, Club, ICCTestCentre", { region: "Overseas" }),
      p("4", "Delta Boat Club", "Club", { topPick: true }),
      p("5", "Echo Yacht Club", "Training Centre, Club", { topPick: false }),
    ];
    const r = topRanks(list, 3);
    expect([...r.entries()]).toEqual([["4", 1], ["1", 2], ["2", 3]]);
  });
});
