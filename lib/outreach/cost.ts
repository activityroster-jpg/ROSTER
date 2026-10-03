/** Claude list prices in US dollars per million tokens, used to estimate the outreach agent's spend. */
export interface TokenUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const FALLBACK = PRICES["claude-opus-5-5"]!;

/** Cost in millionths of a dollar (integer, safe to sum in SQLite). */
export function costMicros(model: string, u: TokenUsage): number {
  const p = PRICES[model] ?? FALLBACK;
  const usd = (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 1_000_000);
}

export const fmtUsd = (micros: number): string => {
  const usd = micros / 1_000_000;
  return usd < 0.01 && usd > 0 ? "<$0.01" : `$${usd.toFixed(2)}`;
};

/** Shape the SDK's `usage` block into our row. */
export function fromSdkUsage(u: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined): TokenUsage {
  return { inputTokens: u?.input_tokens ?? 0, outputTokens: u?.output_tokens ?? 0, cacheReadTokens: u?.cache_read_input_tokens ?? 0, cacheWriteTokens: u?.cache_creation_input_tokens ?? 0 };
}

/** Callback the research and writer modules use to report each call; the engine stores it. */
export type UsageSink = (kind: "research" | "draft", model: string, usage: TokenUsage) => Promise<void> | void;
