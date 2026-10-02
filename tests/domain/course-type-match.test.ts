import { describe, it, expect } from "vitest";
import { courseTypeScore, suggestCourseType } from "@/lib/domain";

const types = [
  { id: "s1", name: "Youth Stage 1" },
  { id: "s2", name: "Youth Stage 2" },
  { id: "l1", name: "Adult Level 1 Start Sailing" },
  { id: "l2", name: "Adult Level 2 Basic Skills" },
  { id: "pb2", name: "Powerboat Level 2" },
  { id: "w", name: "Windsurfing Start" },
];

describe("suggestCourseType", () => {
  it("matches booking-system names with extra words, dates and punctuation", () => {
    expect(suggestCourseType("RYA Youth Stage 1 – Summer Week (14/07/2026)", types)?.type.id).toBe("s1");
    expect(suggestCourseType("Kids Stage2", types)?.type.id).toBe("s2");
    expect(suggestCourseType("PB Lvl 2 weekend", types)?.type.id).toBe("pb2");
    expect(suggestCourseType("RYA Level 1 Start Sailing (adults)", types)?.type.id).toBe("l1");
  });

  it("never confuses levels/stages", () => {
    expect(courseTypeScore("Youth Stage 3", "Youth Stage 1")).toBe(0);
    expect(suggestCourseType("Powerboat Level 1", types)).toBeNull();
  });

  it("returns null for names that don't resemble any type", () => {
    expect(suggestCourseType("Birthday party", types)).toBeNull();
    expect(suggestCourseType("", types)).toBeNull();
  });

  it("scores an exact (normalised) name as a perfect match", () => {
    expect(courseTypeScore("windsurfing start", "Windsurfing Start")).toBe(1);
  });
});
