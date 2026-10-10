/**
 * Letter batches ("Download next 10 letters") are not stored as their own
 * record: each centre in a batch gets a log entry with this summary, written in
 * one go. Grouping those entries by who printed them and when rebuilds every
 * batch, including ones printed before this list existed.
 */
export const LETTER_BATCH_SUMMARY = "Letter printed in a batch: Ready to send";

/** Entries further apart than this belong to different batches. */
const GAP_MS = 60_000;

export interface LetterBatchEntry { prospectId: string; author: string | null; createdAt: Date }
export interface LetterBatch { key: string; printedAt: Date; author: string | null; prospectIds: string[] }

/** Newest batch first; centres inside a batch in the order they were logged (the print order). */
export function groupLetterBatches(entries: LetterBatchEntry[]): LetterBatch[] {
  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const batches: LetterBatch[] = [];
  const lastAt = new Map<LetterBatch, number>();
  for (const e of sorted) {
    const t = e.createdAt.getTime();
    let open: LetterBatch | undefined;
    for (let i = batches.length - 1; i >= 0 && !open; i--) if (batches[i]!.author === e.author) open = batches[i];
    if (open && t - (lastAt.get(open) ?? 0) <= GAP_MS && !open.prospectIds.includes(e.prospectId)) {
      open.prospectIds.push(e.prospectId);
    } else {
      const b: LetterBatch = { key: `${t}`, printedAt: e.createdAt, author: e.author, prospectIds: [e.prospectId] };
      batches.push(b);
      lastAt.set(b, t);
      continue;
    }
    lastAt.set(open, t);
  }
  return batches.reverse();
}
