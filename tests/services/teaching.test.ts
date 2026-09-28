import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getTeachingMatrix } from "@/lib/services/teaching";
import { instructor as instructorTable } from "@/lib/db/schema";

describe("getTeachingMatrix", () => {
  it("derives teachable courses from held qualifications, honouring explicit rules and discipline", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Lake SC", slug: "lake", jurisdiction: "england" });

    const me = (await repos.tenant.instructor.list(ctx, eq(instructorTable.name, "Instructor lake")))[0]!;
    const matrix = await getTeachingMatrix(repos, ctx);
    const mine = matrix.get(me.id) ?? [];

    // The fixture instructor holds a dinghy grade, so should teach dinghy courses…
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((c) => c.name.toLowerCase().includes("sailing"))).toBe(true);
    // …but not a powerboat course they hold no ticket for.
    expect(mine.some((c) => c.name.toLowerCase().includes("powerboat"))).toBe(false);
    // The course type with an explicit staffing rule is flagged explicit.
    expect(mine.some((c) => c.explicit)).toBe(true);
  });
});
