import { describe, it, expect } from "vitest";
import { createTestDb } from "../helpers/test-db";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { NewMarketingProspect } from "@/lib/db/schema";

type ProspectInput = Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">;

function prospect(name: string, postcode?: string): ProspectInput {
  return { name, postcode: postcode ?? null, country: "United Kingdom", source: "import" };
}

describe("marketing prospect bulk import", () => {
  it("inserts a large batch by chunking under D1's 100-param cap", async () => {
    const { db } = createTestDb();
    const repo = new PlatformRepository(db);
    // 404 rows is well past the ~5-rows-per-statement ceiling a single insert
    // would hit on D1; chunking must handle it without dropping any.
    const rows = Array.from({ length: 404 }, (_, i) => prospect(`Centre ${i}`, `PC${i}`));
    const count = await repo.insertProspects(rows);
    expect(count).toBe(404);
    expect(await repo.countProspects()).toBe(404);
  });

  it("skips duplicates on re-import (idempotent by name + postcode)", async () => {
    const { db } = createTestDb();
    const repo = new PlatformRepository(db);
    const first = await repo.insertProspectsUnique([
      prospect("Aldeburgh Yacht Club", "IP15 5NA"),
      prospect("Brightlingsea Sailing Club", "CO7 0DY"),
    ]);
    expect(first).toEqual({ inserted: 2, skipped: 0 });

    // Re-paste the same two plus one genuinely new centre.
    const second = await repo.insertProspectsUnique([
      prospect("Aldeburgh Yacht Club", "IP15 5NA"),
      prospect("brightlingsea sailing club", "co7 0dy"), // case-insensitive match
      prospect("Alton Water Sports Centre", "IP9 2RY"),
    ]);
    expect(second).toEqual({ inserted: 1, skipped: 2 });
    expect(await repo.countProspects()).toBe(3);
  });

  it("de-dupes within a single incoming batch", async () => {
    const { db } = createTestDb();
    const repo = new PlatformRepository(db);
    const res = await repo.insertProspectsUnique([
      prospect("Same Club", "AB1 2CD"),
      prospect("Same Club", "AB1 2CD"),
    ]);
    expect(res).toEqual({ inserted: 1, skipped: 1 });
    expect(await repo.countProspects()).toBe(1);
  });

  it("merge import updates matches, inserts new, and never clobbers with blanks", async () => {
    const { db } = createTestDb();
    const repo = new PlatformRepository(db);
    await repo.insertProspects([
      { ...prospect("Aldeburgh Yacht Club", "IP15 5NA"), email: "old@ayc.test", contactName: "A. Person", notes: "Called in May" },
    ]);
    const [existing] = await repo.listProspects();
    await repo.setProspectStatus(existing!.id, "email_sent");

    const SRC = "RYA directory sweep, Oct 2026";
    const res = await repo.upsertProspects(
      [
        // Same centre, postcode spaced differently; new email + website, blank contact.
        { ...prospect("aldeburgh yacht club", "IP155NA"), email: "info@ayc.test", website: "ayc.test", contactName: null, notes: "Source: RYA listing" },
        prospect("Alton Water Sports Centre", "IP9 2RY"),
        prospect("Alton Water Sports Centre", "IP9 2RY"), // in-batch duplicate
      ],
      SRC,
    );
    expect(res).toEqual({ inserted: 1, updated: 1, unchanged: 1 });
    expect(await repo.countProspects()).toBe(2);

    const rows = await repo.listProspects();
    const ayc = rows.find((r) => r.id === existing!.id)!;
    expect(ayc.name).toBe("Aldeburgh Yacht Club");
    expect(ayc.postcode).toBe("IP15 5NA"); // match key not rewritten
    expect(ayc.email).toBe("info@ayc.test");
    expect(ayc.website).toBe("ayc.test");
    expect(ayc.contactName).toBe("A. Person"); // blank didn't overwrite
    expect(ayc.status).toBe("email_sent"); // pipeline untouched
    expect(ayc.notes).toBe("Called in May\nSource: RYA listing"); // appended
    expect(ayc.source).toBe(SRC);
    expect(rows.find((r) => r.name === "Alton Water Sports Centre")!.source).toBe(SRC);

    // Re-running the same import is a no-op (notes not re-appended).
    const again = await repo.upsertProspects(
      [{ ...prospect("Aldeburgh Yacht Club", "IP15 5NA"), email: "info@ayc.test", notes: "Source: RYA listing" }],
      SRC,
    );
    expect(again).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
  });
});
