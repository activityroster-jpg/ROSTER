import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { schema } from "./schema";

/**
 * The database handle type used everywhere in the app and tests.
 *
 * Production runs on Cloudflare D1 (async driver); tests run on better-sqlite3
 * (sync driver). Both expose the identical Drizzle query API, so the repository
 * layer is written once against this shared type and awaited uniformly.
 */
export type Database = BaseSQLiteDatabase<"async" | "sync", unknown, typeof schema>;

/**
 * Build the Drizzle client for a Cloudflare D1 binding. Imported lazily so the
 * D1 driver is only pulled in on the Workers runtime, keeping it out of the
 * Node test bundle.
 */
export async function d1Database(binding: D1Database): Promise<Database> {
  const { drizzle } = await import("drizzle-orm/d1");
  return drizzle(binding, { schema }) as unknown as Database;
}
