import { describe, expect, it } from "vitest";
import { PIPELINE_COLUMNS, PIPELINE_STAGES, draftProspectEmail, outreachSentOn, sentAgeTone, stageOf, stageRank, statusesForStage, vibeOf, workingDaysSince } from "@/lib/marketing";
import type { ProspectStatus } from "@/lib/db/schema";

describe("pipeline stages", () => {
  it("works the step out from the ticks: the furthest one wins", () => {
    expect(stageOf([])).toBe("none");
    expect(stageOf(["new"])).toBe("none");
    expect(stageOf(["linkedin_contacted"])).toBe("none");
    expect(stageOf(["ready_to_send"])).toBe("ready");
    // The older letter and flyer ticks count as "Ready to send" (posted, booklet still to go).
    expect(stageOf(["ready_to_send", "letter_sent"])).toBe("ready");
    expect(stageOf(["letter_sent", "flyer_sent"])).toBe("ready");
    expect(stageOf(["letter_sent", "booklet_sent", "flyer_sent"])).toBe("booklet");
    expect(stageOf(["booklet_sent", "email_sent"])).toBe("email");
    expect(stageOf(["email_sent", "called"])).toBe("called");
    expect(stageOf(["letter_sent", "rejected"])).toBe("rejected");
    expect(stageOf(["rejected", "purchased"])).toBe("signed_up");
  });

  it("shows every step but rejected as a column, in order", () => {
    expect(PIPELINE_COLUMNS).toEqual(["none", "ready", "booklet", "email", "called", "signed_up"]);
    expect(PIPELINE_STAGES.filter((s) => !(PIPELINE_COLUMNS as readonly string[]).includes(s))).toEqual(["rejected"]);
  });

  it("lands a prospect in exactly the column chosen, whatever it was before", () => {
    const starts: ProspectStatus[][] = [[], ["new"], ["letter_sent"], ["letter_sent", "email_sent"], ["booklet_sent", "called"], ["purchased"], ["rejected", "letter_sent"], ["ready_to_send", "flyer_sent"], ["linkedin_contacted", "email_sent"]];
    for (const from of starts) for (const to of PIPELINE_STAGES) expect(stageOf(statusesForStage(from, to))).toBe(to);
  });

  it("keeps the earlier steps and LinkedIn; clears what comes after", () => {
    expect(statusesForStage(["letter_sent", "email_sent", "called", "linkedin_contacted"], "none")).toEqual(["linkedin_contacted"]);
    expect(statusesForStage(["letter_sent"], "none")).toEqual([]);
    expect(statusesForStage(["letter_sent", "booklet_sent", "called"], "email")).toEqual(["letter_sent", "booklet_sent", "email_sent"]);
    expect(statusesForStage(["booklet_sent", "email_sent"], "booklet")).toEqual(["booklet_sent"]);
    expect(statusesForStage(["letter_sent", "email_sent"], "signed_up")).toEqual(["letter_sent", "email_sent", "purchased"]);
    expect(statusesForStage(["booklet_sent", "purchased"], "rejected")).toEqual(["booklet_sent", "rejected"]);
  });

  it("sorts rejected first and signed up last", () => {
    expect(PIPELINE_STAGES.map(stageRank)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("colours the vibe: red rejected, green signed up, orange engaged, nothing otherwise", () => {
    expect(vibeOf("rejected", true)).toBe("red");
    expect(vibeOf("signed_up", false)).toBe("green");
    expect(vibeOf("booklet", true)).toBe("orange");
    expect(vibeOf("none", false)).toBeNull();
  });
});

describe("days since the booklet or email went", () => {
  const on = (iso: string) => new Date(`${iso}T12:00:00`);

  it("counts Monday to Friday only, starting the day after it went", () => {
    expect(workingDaysSince("2026-10-12", on("2026-10-12"))).toBe(0); // Monday, same day
    expect(workingDaysSince("2026-10-12", on("2026-10-16"))).toBe(4); // Mon → Fri
    expect(workingDaysSince("2026-10-12", on("2026-10-18"))).toBe(4); // the weekend adds nothing
    expect(workingDaysSince("2026-10-12", on("2026-10-19"))).toBe(5); // the next Monday
    expect(workingDaysSince("2026-10-09", on("2026-10-23"))).toBe(10); // Fri → Fri a fortnight on
    expect(workingDaysSince("not a date", on("2026-10-23"))).toBe(0);
  });

  it("is green under 5 working days, orange 5 to 8, red after", () => {
    expect(sentAgeTone(0)).toBe("green");
    expect(sentAgeTone(4)).toBe("green");
    expect(sentAgeTone(5)).toBe("orange");
    expect(sentAgeTone(8)).toBe("orange");
    expect(sentAgeTone(9)).toBe("red");
  });

  it("finds the latest booklet and email dates in the log, ignoring unticks", () => {
    const sent = outreachSentOn([
      { kind: "stage", summary: "Ready to send → Booklet sent", occurredOn: "2026-10-01" },
      { kind: "stage", summary: "Ticked Booklet sent", occurredOn: "2026-10-06" },
      { kind: "stage", summary: "Unticked Booklet sent", occurredOn: "2026-10-09" },
      { kind: "email_out", summary: "Sent the follow-up", occurredOn: "2026-10-10" },
      { kind: "stage", summary: "Booklet sent → Email sent", occurredOn: "2026-10-13" },
      { kind: "note", summary: "Booklet sent twice?", occurredOn: "2026-10-14" },
    ]);
    expect(sent).toEqual({ booklet: "2026-10-06", email: "2026-10-13" });
    expect(outreachSentOn([])).toEqual({ booklet: null, email: null });
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
