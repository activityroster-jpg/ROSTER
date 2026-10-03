import { describe, expect, it } from "vitest";
import { costMicros, fmtUsd, fromSdkUsage } from "@/lib/outreach/cost";
import { dailyUsage, summariseUsage } from "@/lib/outreach/usage";
import type { AiUsage } from "@/lib/db/schema";

describe("cost estimate", () => {
  it("prices Opus 5.5 at list: $4 in, $20 out, $0.20 cache read", () => {
    expect(costMicros("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(4_000_000);
    expect(costMicros("claude-opus-5-5", { inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(20_000_000);
    expect(costMicros("claude-opus-5-5", { inputTokens: 10_000, outputTokens: 500, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(50_000); // 5 cents
  });
  it("formats dollars and tiny amounts", () => {
    expect(fmtUsd(50_000)).toBe("$0.05");
    expect(fmtUsd(1_234_567)).toBe("$1.23");
    expect(fmtUsd(900)).toBe("<$0.01");
    expect(fmtUsd(0)).toBe("$0.00");
  });
  it("tolerates a missing usage block", () => {
    expect(fromSdkUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(fromSdkUsage({ input_tokens: 5, output_tokens: 6, cache_read_input_tokens: null, cache_creation_input_tokens: 2 })).toEqual({ inputTokens: 5, outputTokens: 6, cacheReadTokens: 0, cacheWriteTokens: 2 });
  });
});

const row = (at: string, kind: "research" | "draft", cost: number): AiUsage => ({
  id: at + kind, kind, model: "claude-opus-5-5", campaignId: null, leadId: null, inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: cost, createdAt: new Date(at),
});

describe("usage summary", () => {
  const now = new Date("2026-06-17T15:00:00Z"); // Wednesday
  const rows = [
    row("2026-06-17T09:00:00Z", "research", 50_000),  // today
    row("2026-06-16T09:00:00Z", "draft", 20_000),     // yesterday (this week)
    row("2026-06-14T09:00:00Z", "draft", 20_000),     // Sunday (last week, this month)
    row("2026-05-30T09:00:00Z", "research", 50_000),  // last month
  ];
  it("splits into today / week / month in London time", () => {
    const [day, week, month] = summariseUsage(rows, now, { day: 1, week: 5, month: 9 });
    expect(day!.costMicros).toBe(50_000); expect(day!.research).toBe(1); expect(day!.emailsSent).toBe(1);
    expect(week!.costMicros).toBe(70_000); expect(week!.drafts).toBe(1);
    expect(month!.costMicros).toBe(90_000); expect(month!.calls).toBe(3);
  });
  it("lists daily totals newest first", () => {
    const d = dailyUsage(rows, now, 4);
    expect(d).toHaveLength(4);
    expect(d[0]!.costMicros).toBe(50_000);
    expect(d[1]!.costMicros).toBe(20_000);
    expect(d[3]!.costMicros).toBe(20_000);
  });
});
