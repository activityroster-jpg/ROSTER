import { describe, expect, it } from "vitest";
import { DEFAULT_ROTA_TEMPLATE, parseRotaTemplate, rangeBounds, shortNames } from "@/lib/rota/template";

describe("rota template", () => {
  it("shows first names, adding a surname initial only for shared first names", () => {
    const m = shortNames(["Sam Jones", "Sam Patel", "Alex Brown", "Sam Jones", "Jo"]);
    expect(m.get("Sam Jones")).toBe("Sam J");
    expect(m.get("Sam Patel")).toBe("Sam P");
    expect(m.get("Alex Brown")).toBe("Alex");
    expect(m.get("Jo")).toBe("Jo");
  });
  it("falls back to full names when first name and initial both clash", () => {
    const m = shortNames(["Sam Jones", "Sam Jackson"]);
    expect(m.get("Sam Jones")).toBe("Sam Jones");
    expect(m.get("Sam Jackson")).toBe("Sam Jackson");
  });
  it("parses stored JSON leniently", () => {
    expect(parseRotaTemplate(null)).toEqual(DEFAULT_ROTA_TEMPLATE);
    expect(parseRotaTemplate("{}")).toEqual(DEFAULT_ROTA_TEMPLATE);
    expect(parseRotaTemplate("not json")).toEqual(DEFAULT_ROTA_TEMPLATE);
    const t = parseRotaTemplate(JSON.stringify({ range: "month", orientation: "horizontal", fields: { equipment: true, bogus: 1 } }));
    expect(t.range).toBe("month");
    expect(t.orientation).toBe("horizontal");
    expect(t.fields.equipment).toBe(true);
    expect(t.fields.times).toBe(true);
    expect(parseRotaTemplate(JSON.stringify({ range: "year" })).range).toBe("week");
  });
  it("works out the period from any date", () => {
    expect(rangeBounds("week", "2026-10-07")).toMatchObject({ from: "2026-10-05", days: 7 });
    expect(rangeBounds("month", "2026-02-10")).toMatchObject({ from: "2026-02-01", days: 28 });
    expect(rangeBounds("day", "2026-10-07")).toMatchObject({ from: "2026-10-07", days: 1 });
    expect(rangeBounds("week", "2026-10-07").title).toMatch(/Week of 5 Oct – 11 Oct 2026/);
  });
});
