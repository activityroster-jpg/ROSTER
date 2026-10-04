import type { Database } from "./client";

/**
 * Run several prepared statements as one unit (audit C2). On Cloudflare D1
 * this is `db.batch`, which D1 executes as a single implicit transaction: all
 * the statements land or none do, so a dropped connection can never leave half
 * a course. The better-sqlite3 test driver has no batch; there the statements
 * simply run in order (tests don't lose their connection mid-way).
 *
 * Statements come from the tenant repositories (`insertStatement`), so the org
 * id is still forced on every row.
 */
type Runnable = PromiseLike<unknown>;

export async function runAtomic(db: Database, statements: readonly Runnable[]): Promise<void> {
  if (statements.length === 0) return;
  const batch = (db as unknown as { batch?: (q: readonly Runnable[]) => Promise<unknown> }).batch;
  if (typeof batch === "function") {
    await batch.call(db, statements);
    return;
  }
  for (const s of statements) await s;
}
