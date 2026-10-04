import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { getPayrollLines, payrollLinesToCsv, summariseByInstructor } from "@/lib/services/finance";
import { periodRange, resolvePayrollFilter, payrollQuerySchema } from "@/lib/validation/payroll";

describe("payroll lines", () => {
  it("reports start/finish from the clock, applies the unpaid lunch rule, and filters by period", async () => {
    const { db } = createTestDb();
    const { repos, ctx } = await seedFullOrg(db, { name: "Pay", slug: "pay", jurisdiction: "england" });
    const s = (await repos.tenant.orgSettings.list(ctx))[0]!;
    // Fixture shift is 3h (180 min) at £25/h. Break of 30 min after 2h, unpaid.
    await repos.tenant.orgSettings.update(ctx, s.id, { breakAfterMinutes: 120, breakMinutes: 30, breakPaid: false });

    const { lines } = await getPayrollLines(repos, ctx, { from: "2026-01-01", to: "2026-01-31" });
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect([l.start, l.finish, l.clocked]).toEqual(["09:00", "12:00", true]);
    expect([l.workedMinutes, l.breakMinutes, l.payableMinutes]).toEqual([180, 30, 150]);
    expect(l.pay).toBe(62.5);
    expect(summariseByInstructor(lines)[0]!.pay).toBe(62.5);
    expect(payrollLinesToCsv(lines).split("\n")[1]).toContain("2026-01-05");

    expect((await getPayrollLines(repos, ctx, { from: "2026-02-01" })).lines).toHaveLength(0);
    expect((await getPayrollLines(repos, ctx, { instructorId: "someone-else" })).lines).toHaveLength(0);
  });

  it("parses the query defensively and resolves quick periods", () => {
    const q = payrollQuerySchema.parse({ from: "nope", format: "weird", period: "last-month" });
    expect(q.from).toBeUndefined();
    expect(q.format).toBe("detail");
    expect(periodRange("last-month", new Date(Date.UTC(2026, 2, 15)))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolvePayrollFilter({ ...q, period: "custom", from: "2026-01-01" })).toEqual({ from: "2026-01-01", to: undefined, instructorId: undefined, includeVolunteers: false });
  });
});
