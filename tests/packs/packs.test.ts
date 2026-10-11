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
    expect(isActivityType("sailing_club")).toBe(true);
    expect(isActivityType("ski_school")).toBe(false);
  });

  for (const pack of PACK_LIST) {
    describe(pack.label, () => {
      it("has every list the seeder needs", () => {
        expect(pack.slots.map((s) => s.code)).toEqual(["AM", "PM", "EV"]);
        expect(pack.roles.length).toBeGreaterThan(2);
        expect(pack.roles.some((r) => r.countsTowardRatio)).toBe(true);
        expect(pack.roles.some((r) => r.isSafetyCover)).toBe(true);
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
    expect(padi.grades.every((g) => ["diving", "freediving", "first_aid", "powerboat"].includes(g.discipline))).toBe(true);
    expect(padi.courseTypes.every((c) => c.scheme.startsWith("PADI"))).toBe(true);
    expect(padi.compliance("england").map((c) => c.code)).toContain("PADI_RENEWAL");
    expect(padi.compliance("england").map((c) => c.code)).toContain("DIVE_MEDICAL");
    expect(padi.roles.find((r) => r.isSafetyCover)?.name).toBe("Boat Skipper");
  });

  it("the sailing club shares the RYA lists with club roles added", () => {
    const club = PACKS.sailing_club;
    expect(club.grades).toBe(PACKS.rya_centre.grades);
    expect(club.roles.map((r) => r.code)).toContain("DUTY_OFFICER");
    expect(club.courseTypes.map((c) => c.name)).toEqual(expect.arrayContaining(PACKS.rya_centre.courseTypes.map((c) => c.name)));
  });
});
