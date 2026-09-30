import { describe, it, expect } from "vitest";
import { mapBookwhenEvents } from "@/lib/integrations/adapters/bookwhen";

describe("mapBookwhenEvents", () => {
  it("maps a Bookwhen JSON:API events payload to import drafts", () => {
    const json = {
      data: [
        {
          id: "ev-1",
          type: "event",
          attributes: {
            title: "Youth Stage 1",
            start_at: "2099-07-01T09:00:00+01:00",
            end_at: "2099-07-01T12:00:00+01:00",
            location: { address_text: "Main pontoon" },
          },
        },
        {
          id: "ev-2",
          type: "event",
          attributes: { title: "", start_at: "", end_at: "" },
        },
      ],
    };
    const drafts = mapBookwhenEvents(json);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ name: "Youth Stage 1", date: "2099-07-01", startTime: "09:00", endTime: "12:00", location: "Main pontoon" });
    // The empty event is flagged, not dropped (review surfaces it).
    expect(drafts[1]!.issues.length).toBeGreaterThan(0);
  });

  it("returns [] for a malformed payload", () => {
    expect(mapBookwhenEvents(null)).toEqual([]);
    expect(mapBookwhenEvents({})).toEqual([]);
    expect(mapBookwhenEvents({ data: "nope" })).toEqual([]);
  });
});
