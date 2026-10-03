import type { AiUsage } from "@/lib/db/schema";
import { londonDayStart, londonMonthStart, londonWeekStart } from "./engine";

export interface UsagePeriod { label: string; from: Date; calls: number; research: number; drafts: number; inputTokens: number; outputTokens: number; costMicros: number; emailsSent: number }

/** Aggregate usage rows into today / this week / this month (London time). */
export function summariseUsage(rows: AiUsage[], now: Date, sent: { day: number; week: number; month: number }): UsagePeriod[] {
  const periods: { label: string; from: Date; emailsSent: number }[] = [
    { label: "Today", from: londonDayStart(now), emailsSent: sent.day },
    { label: "This week", from: londonWeekStart(now), emailsSent: sent.week },
    { label: "This month", from: londonMonthStart(now), emailsSent: sent.month },
  ];
  return periods.map((p) => {
    const inRange = rows.filter((r) => r.createdAt >= p.from && r.createdAt <= now);
    return {
      ...p,
      calls: inRange.length,
      research: inRange.filter((r) => r.kind === "research").length,
      drafts: inRange.filter((r) => r.kind === "draft").length,
      inputTokens: inRange.reduce((a, r) => a + r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0),
      outputTokens: inRange.reduce((a, r) => a + r.outputTokens, 0),
      costMicros: inRange.reduce((a, r) => a + r.costMicros, 0),
    };
  });
}

/** Per-day totals for the last `days` London days, newest first. */
export function dailyUsage(rows: AiUsage[], now: Date, days = 14): { dayKey: string; calls: number; costMicros: number }[] {
  const out: { dayKey: string; calls: number; costMicros: number }[] = [];
  let end = now;
  for (let i = 0; i < days; i++) {
    const start = londonDayStart(end);
    const inRange = rows.filter((r) => r.createdAt >= start && r.createdAt <= end);
    out.push({ dayKey: start.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }), calls: inRange.length, costMicros: inRange.reduce((a, r) => a + r.costMicros, 0) });
    end = new Date(start.getTime() - 1);
  }
  return out;
}
