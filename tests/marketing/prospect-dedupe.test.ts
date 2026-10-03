import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { PlatformRepository } from "@/lib/db/repositories/platform";

describe("prospect de-duplication", () => {
  it("merges same name + postcode, keeps the furthest-along row and unions touchpoints", async () => {
    const { db } = createTestDb();
    const p = new PlatformRepository(db);
    await p.insertProspects([
      { name: "Blue Water SC", postcode: "EX1 1AA", status: "new", statuses: null, notes: "first", source: "manual" },
      { name: "blue water sc", postcode: "ex11aa", status: "letter_sent", statuses: JSON.stringify(["letter_sent"]), notes: null, email: "hello@bw.test", source: "rya" },
      { name: "Blue Water SC", postcode: null, status: "new", statuses: null, notes: "no postcode row", source: "manual" },
      { name: "Blue Water SC", postcode: "TQ1 2BB", status: "new", statuses: null, notes: null, source: "manual" }, // different place, keep
      { name: "Other Club", postcode: "EX1 1AA", status: "new", statuses: null, notes: null, source: "manual" },
    ] as never);
    const r = await p.dedupeProspects();
    expect(r.groups).toBe(1);
    expect(r.removed).toBe(2);
    const left = await p.listProspects(100, 0);
    expect(left).toHaveLength(3);
    const keeper = left.find((x) => x.email === "hello@bw.test")!;
    expect(keeper).toBeTruthy();
    expect(keeper.status).toBe("letter_sent");
    expect(keeper.notes).toContain("first");
    expect(keeper.notes).toContain("no postcode row");
    expect(keeper.postcode).toBe("ex11aa");
    // Running again changes nothing.
    expect((await p.dedupeProspects()).removed).toBe(0);
  });
});
