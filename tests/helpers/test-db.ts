import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schema } from "@/lib/db/schema";
import type { Database as DrizzleDatabase } from "@/lib/db/client";
import { D1_MAX_PARAMS } from "@/lib/db/params";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "lib", "db", "migrations");


/** Placeholders in a statement, ignoring any "?" inside quoted text. */
function countParams(source: string): number {
  return (source.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "").match(/\?/g) ?? []).length;
}

/**
 * Build an isolated in-memory database with the full schema applied from the
 * generated migration SQL. Every test gets its own DB, so there is no shared
 * state between tests. Using the real migrations (not a hand-written DDL) means
 * these tests also guard the migrations themselves.
 */
export function createTestDb(): { db: DrizzleDatabase; raw: Database.Database } {
  const raw = new Database(":memory:");
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) raw.exec(trimmed);
    }
  }

  // D1 refuses a statement with more than 100 bound parameters; SQLite allows
  // 32,766. Refuse them here too, so a query that would only fail in
  // production fails in the tests first.
  const prepare = raw.prepare.bind(raw);
  raw.prepare = ((source: string) => {
    const n = countParams(source);
    if (n > D1_MAX_PARAMS) throw new Error(`too many SQL variables: ${n} bound parameters (D1 allows ${D1_MAX_PARAMS})`);
    return prepare(source);
  }) as typeof raw.prepare;

  const db = drizzle(raw, { schema }) as unknown as DrizzleDatabase;
  return { db, raw };
}
