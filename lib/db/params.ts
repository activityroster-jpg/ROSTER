import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * Cloudflare D1 refuses a statement with more than 100 bound parameters
 * ("too many SQL variables"), and `inArray` binds one parameter per value.
 */
export const D1_MAX_PARAMS = 100;

/**
 * `column IN (values)` as ONE bound parameter, however long the list: the
 * values travel as a JSON array that SQLite unpacks with `json_each` (the
 * pattern Cloudflare documents for passing lists to D1). Use it for id lists
 * that grow with the centre, such as a week's sessions or a season's courses.
 */
export function inList(column: SQLiteColumn, values: readonly string[]): SQL {
  return sql`${column} in (select value from json_each(${JSON.stringify([...new Set(values)])}))`;
}

/**
 * How many rows of `table` fit in one INSERT: every column of every row is one
 * parameter, and a few are kept back for the statement itself (an upsert's
 * ON CONFLICT clause binds the org id).
 */
export function rowsPerInsert(table: SQLiteTable): number {
  return Math.max(1, Math.floor((D1_MAX_PARAMS - 5) / Object.keys(getTableColumns(table)).length));
}
