import { z } from "zod";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Payroll filter from the query string. Bad values are dropped, never trusted. */
export const payrollQuerySchema = z.object({
  from: iso.optional().catch(undefined),
  to: iso.optional().catch(undefined),
  instructor: z.string().min(1).max(64).optional().catch(undefined),
  format: z.enum(["detail", "summary"]).catch("detail"),
  period: z.enum(["week", "month", "last-month", "custom", "all"]).optional().catch(undefined),
});
export type PayrollQuery = z.infer<typeof payrollQuerySchema>;

/** Resolve a quick period (this week / this month / last month) to a date range. */
export function periodRange(period: PayrollQuery["period"], today = new Date()): { from?: string; to?: string } {
  const d = (dt: Date) => dt.toISOString().slice(0, 10);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  if (period === "week") {
    const mon = new Date(Date.UTC(y, m, today.getUTCDate() - ((today.getUTCDay() + 6) % 7)));
    return { from: d(mon), to: d(new Date(mon.getTime() + 6 * 86_400_000)) };
  }
  if (period === "month") return { from: d(new Date(Date.UTC(y, m, 1))), to: d(new Date(Date.UTC(y, m + 1, 0))) };
  if (period === "last-month") return { from: d(new Date(Date.UTC(y, m - 1, 1))), to: d(new Date(Date.UTC(y, m, 0))) };
  return {};
}

/** The effective filter for a query: an explicit quick period wins over from/to. */
export function resolvePayrollFilter(q: PayrollQuery): { from?: string; to?: string; instructorId?: string } {
  const range = q.period && q.period !== "custom" ? periodRange(q.period) : { from: q.from, to: q.to };
  return { ...range, instructorId: q.instructor };
}
