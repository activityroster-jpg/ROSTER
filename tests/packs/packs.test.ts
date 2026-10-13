import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES, JURISDICTIONS } from "@/lib/db/schema";
import { PACKS, PACK_LIST, PACK_OPTIONS, isActivityType, packFor } from "@/lib/packs";

/**
 * Every activity pack must be a complete, well-formed starting set: the core
 * reads these lists, so a pack with a gap would give a centre a broken start.
 */
describe("activity packs", () => {
  it("has one pack per activity type, in sign-up order", () => {
    expect(PACK_LIST.map((p) => p.id)).toEqual([...ACTIVITY_TYPES]);
    expect(PACK_OPTIONS.map((o) => o.id)).toEqual([...ACTIVITY_TYPES]);
    for (const id of ACTIVITY_TYPES) expect(PACKS[id].id).toBe(id);
  });

  it("falls back to the RYA centre for anything unknown (every centre from before packs)", () => {
    expect(packFor(null).id).toBe("rya_centre");
    expect(packFor("nonsense").id).toBe("rya_centre");
    expect(packFor("padi_centre").id).toBe("padi_centre");
    expect(isActivityType("rya_centre")).toBe(true);
    expect(isActivityType("ski_school")).toBe(false);
  });

  for (const pack of PACK_LIST) {
    describe(pack.label, () => {
      it("has every list the seeder needs", () => {
        expect(pack.slots.map((s) => s.code)).toEqual(["AM", "PM", "EV"]);
        // Places: generic ones, plus one per teaching instructor type where the pack makes them.
        const typePlaces = pack.placesFromTypes ? pack.grades.filter((g) => g.discipline) : [];
        expect(pack.roles.length + typePlaces.length).toBeGreaterThan(2);
        expect(typePlaces.length > 0 || pack.roles.some((r) => r.countsTowardRatio)).toBe(true);
        expect(pack.grades.length).toBeGreaterThan(3);
        expect(pack.equipment.length).toBeGreaterThan(2);
        expect(pack.locationTypes.length).toBeGreaterThan(2);
        expect(pack.courseTypes.length).toBeGreaterThan(5);
        expect(pack.courseTypes.some((c) => c.audience === "youth")).toBe(true);
        for (const w of Object.values(pack.wording)) expect(w.trim().length).toBeGreaterThan(0);
      });

      it("uses unique codes and names, and sensible numbers", () => {
        const unique = (xs: string[]) => expect(new Set(xs).size).toBe(xs.length);
        unique(pack.roles.map((r) => r.code));
        unique(pack.grades.map((g) => g.code));
        unique(pack.grades.map((g) => g.name.toLowerCase()));
        unique(pack.courseTypes.map((c) => c.name.toLowerCase()));
        unique(pack.equipment.map((e) => e.name.toLowerCase()));
        for (const c of pack.courseTypes) {
          expect(c.defaultCapacity).toBeGreaterThan(0);
          expect(c.studentsPerInstructor).toBeGreaterThan(0);
          expect(c.scheme.length).toBeGreaterThan(0);
        }
      });

      it("gives every jurisdiction a vetting check and expiry-tracked checks, none mandatory by default", () => {
        for (const j of JURISDICTIONS) {
          const checks = pack.compliance(j);
          expect(checks.filter((c) => c.isVetting)).toHaveLength(1);
          expect(checks.some((c) => c.expiryTracked)).toBe(true);
          expect(new Set(checks.map((c) => c.code)).size).toBe(checks.length);
          for (const c of checks) expect(c.mandatory).toBe(false);
        }
      });
    });
  }

  it("the PADI pack is diving, not sailing", () => {
    const padi = PACKS.padi_centre;
    expect(padi.grades.every((g) => ["diving", "freediving", "first_aid", "powerboat", "none"].includes(g.discipline ?? "none"))).toBe(true);
    expect(padi.courseTypes.every((c) => c.scheme.startsWith("PADI"))).toBe(true);
    expect(padi.compliance("england").map((c) => c.code)).toContain("PADI_RENEWAL");
    expect(padi.compliance("england").map((c) => c.code)).toContain("DIVE_MEDICAL");
    expect(padi.roles.find((r) => r.isSafetyCover)?.name).toBe("Boat Skipper");
  });

  it("the RYA course map names real instructor types and courses, and covers every starting course", () => {
    const pack = PACKS.rya_centre;
    const codes = new Set(pack.grades.map((g) => g.code));
    const courses = new Set(pack.courseTypes.map((c) => c.name));
    for (const r of pack.teaching ?? []) {
      expect(codes.has(r.type), r.type).toBe(true);
      expect(courses.has(r.course), r.course).toBe(true);
      if (r.alsoRequires) expect(codes.has(r.alsoRequires), r.alsoRequires).toBe(true);
    }
    const mapped = new Set((pack.teaching ?? []).map((r) => r.course));
    expect(pack.courseTypes.filter((c) => !mapped.has(c.name)).map((c) => c.name)).toEqual([]);
    // No separate safety boat driver: the instructor drives the safety boat.
    expect(pack.roles.some((r) => r.isSafetyCover)).toBe(false);
    expect(pack.courseTypes.some((c) => c.requiresSafetyBoat)).toBe(false);
  });

  it("uses Conor's ratios for the RYA starting courses", () => {
    const ratio = (name: string) => PACKS.rya_centre.courseTypes.find((c) => c.name === name)!.studentsPerInstructor;
    expect(ratio("Start Sailing (Level 1)")).toBe(6);
    expect(ratio("Summer Camp (5-day)")).toBe(6);
    expect(ratio("Youth Stage 1")).toBe(6);
    expect(ratio("Start Windsurfing")).toBe(6);
    expect(ratio("Powerboat Level 1")).toBe(3);
    expect(ratio("Safety Boat Course")).toBe(6);
    expect(ratio("Start Keelboating")).toBe(4);
    expect(ratio("Competent Crew")).toBe(5);
    expect(ratio("Day Skipper (Practical)")).toBe(5);
    expect(ratio("Coastal Skipper (Practical)")).toBe(4);
  });
});
