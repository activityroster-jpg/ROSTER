import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, stageOf, stageRank, statusesForStage, vibeOf, draftProspectEmail } from "@/lib/marketing";
import type { ProspectStatus } from "@/lib/db/schema";

describe("pipeline stages", () => {
  it("works the stage out from the stored touchpoints", () => {
    expect(stageOf([])).toBe("none");
    expect(stageOf(["new"])).toBe("none");
    expect(stageOf(["email_sent", "called"])).toBe("none");
    expect(stageOf(["letter_sent"])).toBe("letter");
    expect(stageOf(["letter_sent", "linkedin_contacted"])).toBe("linkedin");
    expect(stageOf(["letter_sent", "rejected"])).toBe("rejected");
    expect(stageOf(["rejected", "purchased"])).toBe("signed_up");
  });

  it("lands a prospect in exactly the stage chosen, whatever it was before", () => {
    const starts: ProspectStatus[][] = [[], ["new"], ["letter_sent"], ["letter_sent", "email_sent"], ["linkedin_contacted", "called"], ["purchased"], ["rejected", "letter_sent"]];
    for (const from of starts) for (const to of PIPELINE_STAGES) expect(stageOf(statusesForStage(from, to))).toBe(to);
  });

  it("keeps emails and calls already logged, and never stores an empty list", () => {
    expect(statusesForStage(["letter_sent", "email_sent", "called"], "none")).toEqual(["email_sent", "called"]);
    expect(statusesForStage(["letter_sent"], "none")).toEqual(["new"]);
    expect(statusesForStage(["letter_sent", "linkedin_contacted"], "signed_up")).toEqual(["letter_sent", "linkedin_contacted", "purchased"]);
    expect(statusesForStage(["linkedin_contacted"], "letter")).toEqual(["letter_sent"]);
  });

  it("sorts rejected first and signed up last", () => {
    expect(PIPELINE_STAGES.map(stageRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it("colours the vibe: red rejected, green signed up, orange engaged, nothing otherwise", () => {
    expect(vibeOf("rejected", true)).toBe("red");
    expect(vibeOf("signed_up", false)).toBe("green");
    expect(vibeOf("letter", true)).toBe("orange");
    expect(vibeOf("none", false)).toBeNull();
  });
});

describe("Gmail drafts", () => {
  it("leave the text signature off so Gmail's own image signature is not doubled", () => {
    const { body } = draftProspectEmail({ name: "Yeadon Sailing Club" }, { signature: false });
    expect(body.endsWith("Kind regards,\nConor")).toBe(true);
    expect(body).not.toContain("Registered office");
  });
});
