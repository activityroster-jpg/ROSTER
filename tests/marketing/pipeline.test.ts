import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, stageOf, stageRank, statusesForStage, vibeOf, draftProspectEmail } from "@/lib/marketing";
import type { ProspectStatus } from "@/lib/db/schema";

describe("pipeline stages", () => {
  it("works the column out from the ticks: the furthest one wins", () => {
    expect(stageOf([])).toBe("none");
    expect(stageOf(["new"])).toBe("none");
    expect(stageOf(["email_sent", "called"])).toBe("none");
    expect(stageOf(["ready_to_send"])).toBe("ready");
    expect(stageOf(["ready_to_send", "letter_sent"])).toBe("letter");
    expect(stageOf(["letter_sent", "flyer_sent"])).toBe("flyer");
    expect(stageOf(["letter_sent", "booklet_sent", "flyer_sent"])).toBe("booklet");
    expect(stageOf(["letter_sent", "rejected"])).toBe("rejected");
    expect(stageOf(["rejected", "purchased"])).toBe("signed_up");
  });

  it("lands a prospect in exactly the column chosen, whatever it was before", () => {
    const starts: ProspectStatus[][] = [[], ["new"], ["letter_sent"], ["letter_sent", "email_sent"], ["booklet_sent", "called"], ["purchased"], ["rejected", "letter_sent"], ["ready_to_send", "flyer_sent"]];
    for (const from of starts) for (const to of PIPELINE_STAGES) expect(stageOf(statusesForStage(from, to))).toBe(to);
  });

  it("keeps emails, calls and what was posted before; clears what comes after", () => {
    expect(statusesForStage(["letter_sent", "email_sent", "called"], "none")).toEqual(["email_sent", "called"]);
    expect(statusesForStage(["letter_sent"], "none")).toEqual([]);
    expect(statusesForStage(["letter_sent", "booklet_sent"], "flyer")).toEqual(["letter_sent", "flyer_sent"]);
    expect(statusesForStage(["letter_sent"], "signed_up")).toEqual(["letter_sent", "purchased"]);
  });

  it("sorts rejected first and signed up last", () => {
    expect(PIPELINE_STAGES.map(stageRank)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("colours the vibe: red rejected, green signed up, orange engaged, nothing otherwise", () => {
    expect(vibeOf("rejected", true)).toBe("red");
    expect(vibeOf("signed_up", false)).toBe("green");
    expect(vibeOf("letter", true)).toBe("orange");
    expect(vibeOf("none", false)).toBeNull();
  });
});

describe("Gmail drafts", () => {
  it("leave the sign-off and signature off so Gmail's own signature is not doubled", () => {
    const { body } = draftProspectEmail({ name: "Yeadon Sailing Club" }, { signature: false });
    expect(body.endsWith("shall I send over a link to look around?")).toBe(true);
    expect(body).not.toContain("Kind regards");
    expect(body).not.toContain("Registered office");
  });
});
