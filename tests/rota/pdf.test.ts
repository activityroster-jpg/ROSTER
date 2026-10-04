import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderRotaPdf, rotaColumns } from "@/lib/pdf/rota-pdf";
import { DEFAULT_ROTA_TEMPLATE, type RotaTemplateSettings } from "@/lib/rota/template";
import type { RotaDay } from "@/lib/services/schedule";

const H = 3_600_000;
function day(date: string, n: number): RotaDay {
  const base = Date.parse(`${date}T09:00:00Z`);
  const sessions = Array.from({ length: n }, (_, i) => ({
    sessionId: `${date}-${i}`, courseId: `c${i}`, slot: (i === 0 ? "AM" : "PM") as "AM" | "PM", startAt: base + i * 4 * H, endAt: base + (i * 4 + 3) * H,
    courseName: i % 2 ? "RYA Youth Stage 2 – dinghy sailing for juniors with a long name" : "Powerboat Level 2", courseTypeName: "x", audience: "all" as const, status: "scheduled",
    coverageOk: true, understaffed: false, missingSafetyCover: false,
    staff: [{ name: "Sam Jones", role: "Senior Instructor", status: "confirmed" as const, instructorId: "i1", roleTypeId: "r1", assignmentId: "a1" }, { name: "Sam Patel", role: "Instructor", status: "assigned" as const, instructorId: "i2", roleTypeId: "r1", assignmentId: "a2" }, { name: "Alex Brown", role: "Safety Boat", status: "declined" as const, instructorId: "i3", roleTypeId: "r1", assignmentId: "a3" }],
    locations: ["Main lake", "Classroom 1"], equipment: ["Safety RIB 1", "Pico ×4"], students: 6,
  }));
  return { date, label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }), sessions };
}
const week = ["05", "06", "07", "08", "09", "10", "11"].map((d, i) => day(`2026-10-${d}`, i === 6 ? 0 : 3));
const all: RotaTemplateSettings["fields"] = { times: true, locations: true, instructors: true, roles: true, equipment: true, students: true };

async function pages(bytes: Uint8Array) { return (await PDFDocument.load(bytes)).getPageCount(); }

describe("rota PDF", () => {
  it("lays the columns out as course, times, staff, then the extras", () => {
    expect(rotaColumns({ ...DEFAULT_ROTA_TEMPLATE, fields: all }).map((c) => c.key)).toEqual(["course", "times", "staff", "students", "where", "kit"]);
    expect(rotaColumns({ ...DEFAULT_ROTA_TEMPLATE, fields: { ...all, times: false, locations: false, students: false } }).map((c) => c.key)).toEqual(["course", "staff", "kit"]);
    expect(rotaColumns({ ...DEFAULT_ROTA_TEMPLATE, fields: all })[2]!.label).toBe("Staff working (role)");
    expect(rotaColumns({ ...DEFAULT_ROTA_TEMPLATE, fields: all })[3]!.label).toBe("Students");
  });
  it("renders every style without error", async () => {
    for (const style of ["classic", "bold", "minimal", "compact"] as const) {
      const pdf = await renderRotaPdf({ centreName: "Club", title: "Monday", days: [day("2026-10-05", 6)], template: { range: "day", orientation: "vertical", style, fields: all } });
      expect(await pages(pdf)).toBeGreaterThanOrEqual(1);
    }
  });
  it("renders a vertical week with every field", async () => {
    const pdf = await renderRotaPdf({ centreName: "Test Sailing Club", title: "Week of 5 Oct – 11 Oct 2026", days: week, template: { ...DEFAULT_ROTA_TEMPLATE, fields: all }, generatedAt: new Date("2026-10-03T12:00:00Z") });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getPage(0).getWidth()).toBeLessThan(doc.getPage(0).getHeight()); // portrait
  });
  it("renders a horizontal week in landscape and a month as a grid", async () => {
    const h = await renderRotaPdf({ centreName: "Test Sailing Club", title: "Week", days: week, template: { range: "week", orientation: "horizontal", style: "bold", fields: all } });
    const hd = await PDFDocument.load(h);
    expect(hd.getPage(0).getWidth()).toBeGreaterThan(hd.getPage(0).getHeight());
    const month = Array.from({ length: 31 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, "0")}`, i % 3));
    const m = await renderRotaPdf({ centreName: "Test Sailing Club", title: "October 2026", days: month, template: { range: "month", orientation: "horizontal", style: "compact", fields: all } });
    expect(await pages(m)).toBeGreaterThanOrEqual(1);
    const mv = await renderRotaPdf({ centreName: "Test Sailing Club", title: "October 2026", days: month, template: { range: "month", orientation: "vertical", style: "minimal", fields: { ...all, equipment: false } } });
    expect(await pages(mv)).toBeGreaterThanOrEqual(2);
  });
  it("copes with an empty period, a single day and awkward characters", async () => {
    const empty = await renderRotaPdf({ centreName: "Café ⛵ Club", title: "Monday", days: [{ ...day("2026-10-05", 0) }], template: DEFAULT_ROTA_TEMPLATE });
    expect(await pages(empty)).toBe(1);
    const one = await renderRotaPdf({ centreName: "Club", title: "Monday 5 October 2026", days: [day("2026-10-05", 4)], template: { range: "day", orientation: "horizontal", style: "classic", fields: all } });
    expect(await pages(one)).toBe(1);
  });
});
