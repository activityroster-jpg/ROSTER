import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { weekStart } from "./schedule";

export interface WeekCost {
  week: string; // Monday ISO
  minutes: number;
  cost: number;
}

export interface InstructorHours {
  instructorId: string;
  name: string;
  minutes: number;
  cost: number;
}

export interface BoatUse {
  name: string;
  bookings: number;
}

export interface LabourReport {
  totalScheduledMinutes: number;
  totalActualMinutes: number;
  totalCost: number;
  instructorsWithHours: number;
  byWeek: WeekCost[];
  byInstructor: InstructorHours[];
  boats: BoatUse[];
}

/**
 * Labour-cost & utilisation reporting, computed entirely from real tenant data
 * (hours records + rates + sessions + equipment bookings). All reads are tenant
 * scoped through the repositories. Pure aggregation, no writes.
 */
export async function getLabourReport(repos: Repositories, ctx: AnyTenantContext): Promise<LabourReport> {
  const t = repos.tenant;
  const [records, instructors, sessions, payRates, courseEquip, equipment] = await Promise.all([
    t.hoursRecord.list(ctx),
    t.instructor.list(ctx),
    t.courseSession.list(ctx),
    t.payRate.list(ctx),
    t.courseEquipment.list(ctx),
    t.equipment.list(ctx),
  ]);

  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  const sessionDate = new Map(sessions.map((s) => [s.id, s.date]));
  // First hourly rate per instructor, as a fallback when a record has no rate.
  const rateByInstructor = new Map<string, number>();
  for (const p of payRates) {
    if (p.instructorId && !rateByInstructor.has(p.instructorId)) rateByInstructor.set(p.instructorId, p.rate);
  }

  let totalScheduledMinutes = 0;
  let totalActualMinutes = 0;
  let totalCost = 0;
  const weekMap = new Map<string, WeekCost>();
  const instrMap = new Map<string, InstructorHours>();

  for (const r of records) {
    const minutes = r.actualMinutes ?? r.scheduledMinutes;
    const rate = r.rate ?? rateByInstructor.get(r.instructorId) ?? null;
    const cost = rate != null ? (minutes / 60) * rate : 0;

    totalScheduledMinutes += r.scheduledMinutes;
    totalActualMinutes += r.actualMinutes ?? 0;
    totalCost += cost;

    const date = r.courseSessionId ? sessionDate.get(r.courseSessionId) : undefined;
    const week = date ? weekStart(new Date(`${date}T00:00:00.000Z`)) : "unscheduled";
    const w = weekMap.get(week) ?? { week, minutes: 0, cost: 0 };
    w.minutes += minutes;
    w.cost += cost;
    weekMap.set(week, w);

    const im = instrMap.get(r.instructorId) ?? { instructorId: r.instructorId, name: nameById.get(r.instructorId) ?? "Unknown", minutes: 0, cost: 0 };
    im.minutes += minutes;
    im.cost += cost;
    instrMap.set(r.instructorId, im);
  }

  // Boat / equipment utilisation: how many course bookings each tracked unit has.
  const equipName = new Map(equipment.map((e) => [e.id, e.name]));
  const boatCount = new Map<string, number>();
  for (const ce of courseEquip) {
    if (!ce.equipmentId) continue;
    boatCount.set(ce.equipmentId, (boatCount.get(ce.equipmentId) ?? 0) + 1);
  }
  const boats: BoatUse[] = [...boatCount.entries()]
    .map(([id, bookings]) => ({ name: equipName.get(id) ?? "Equipment", bookings }))
    .sort((a, b) => b.bookings - a.bookings);

  return {
    totalScheduledMinutes,
    totalActualMinutes,
    totalCost: Math.round(totalCost * 100) / 100,
    instructorsWithHours: instrMap.size,
    byWeek: [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week)),
    byInstructor: [...instrMap.values()].sort((a, b) => b.minutes - a.minutes),
    boats,
  };
}
