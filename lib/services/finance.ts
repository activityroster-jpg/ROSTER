import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";

export interface HoursRow {
  instructorName: string;
  scheduledMinutes: number;
  actualMinutes: number | null;
  rate: number | null;
  pay: number | null;
  approved: boolean;
}

/** Hours (scheduled vs actual) with pay, per instructor record. Tenant scoped. */
export async function getHoursSummary(repos: Repositories, ctx: AnyTenantContext): Promise<HoursRow[]> {
  const [records, instructors] = await Promise.all([
    repos.tenant.hoursRecord.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));

  return records.map((r) => {
    const minutes = r.actualMinutes ?? r.scheduledMinutes;
    const pay = r.rate != null ? Math.round((minutes / 60) * r.rate * 100) / 100 : null;
    return {
      instructorName: nameById.get(r.instructorId) ?? "Unknown",
      scheduledMinutes: r.scheduledMinutes,
      actualMinutes: r.actualMinutes ?? null,
      rate: r.rate ?? null,
      pay,
      approved: r.approved,
    };
  });
}

/** Render hours rows as CSV (finance export). */
export function hoursToCsv(rows: HoursRow[]): string {
  const header = ["Instructor", "Scheduled (h)", "Actual (h)", "Rate", "Pay", "Approved"];
  const lines = rows.map((r) =>
    [
      escapeCsv(r.instructorName),
      (r.scheduledMinutes / 60).toFixed(2),
      r.actualMinutes != null ? (r.actualMinutes / 60).toFixed(2) : "",
      r.rate != null ? r.rate.toFixed(2) : "",
      r.pay != null ? r.pay.toFixed(2) : "",
      r.approved ? "yes" : "no",
    ].join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
