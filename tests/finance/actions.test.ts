import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import type { Database } from "@/lib/db/client";

let db: Database;
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/platform/admin", () => ({ requirePlatformAdmin: async () => ({}) }));
vi.mock("@/lib/cf/bindings", () => ({ getDb: async () => db, getEnv: () => ({}), getRepositories: async () => ({}) }));
vi.mock("@/lib/billing/finance-sync", () => ({ backfillStripeRevenue: async () => ({ invoices: 0, created: 0 }) }));

import { addTransactionAction } from "@/app/admin/finance/actions";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { buildPnl, capitalSummary, cashBalance } from "@/lib/finance/pnl";

const form = (v: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, val] of Object.entries({ date: "2026-05-01", currency: "GBP", ...v })) fd.set(k, val);
  return fd;
};
const settings = { fyStartMonth: 1, reportingCurrency: "GBP" as const, eurToGbp: 0.86, openingCashMinor: 0 };

describe("finance log: director's money", () => {
  beforeEach(() => { ({ db } = createTestDb()); });

  it("a cost the director paid personally adds the matching director's loan line, so the bank doesn't move", async () => {
    const r = await addTransactionAction({ ok: false }, form({ category: "software_ai", description: "Claude subscription", amount: "18.00", vat: "3.00", paidPersonally: "on" }));
    expect(r).toMatchObject({ ok: true });
    const rows = await new PlatformRepository(db).listFinanceTransactions();
    expect(rows.map((t) => t.category).sort()).toEqual(["directors_loan_in", "software_ai"]);
    const loan = rows.find((t) => t.category === "directors_loan_in")!;
    expect(loan).toMatchObject({ amountMinor: 18_00, vatMinor: null, description: "Paid personally: Claude subscription" });
    expect(cashBalance(rows, settings)).toBe(0);
    expect(buildPnl(rows, settings, 2026).operatingExpensesMinor).toBe(18_00);
    expect(capitalSummary(rows, settings, 2026).directorsLoan.closingMinor).toBe(18_00);
  });

  it("salary, a dividend and the director's loan go in as single lines", async () => {
    for (const [category, amount] of [["directors_salary", "1000"], ["dividend_paid", "500"], ["directors_loan_out", "50"]] as const) {
      expect(await addTransactionAction({ ok: false }, form({ category, description: category, amount }))).toMatchObject({ ok: true });
    }
    const rows = await new PlatformRepository(db).listFinanceTransactions();
    expect(rows).toHaveLength(3);
    expect(cashBalance(rows, settings)).toBe(-1550_00);
    expect(buildPnl(rows, settings, 2026).retainedProfitMinor).toBe(-1000_00);
  });

  it("refuses 'paid personally' on anything but a cost", async () => {
    const r = await addTransactionAction({ ok: false }, form({ category: "dividend_paid", description: "Dividend", amount: "100", paidPersonally: "on" }));
    expect(r.ok).toBe(false);
    expect(await new PlatformRepository(db).listFinanceTransactions()).toHaveLength(0);
  });
});
