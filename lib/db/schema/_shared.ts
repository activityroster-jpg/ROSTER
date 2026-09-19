import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * Shared column builders so every table is consistent.
 *
 * IDs are opaque UUID strings generated in code (portable across D1 / SQLite
 * and safe to expose in URLs). Timestamps are stored as epoch-ms integers and
 * surfaced as `Date` by Drizzle.
 */

/** Primary-key id column with a generated UUID default. */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** created_at column, defaults to now. */
export const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** updated_at column, defaults to now and bumps on update. */
export const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/** A required boolean stored as 0/1. */
export const boolCol = (name: string) =>
  integer(name, { mode: "boolean" }).notNull();

/**
 * The tenant discriminator every tenant-owned table carries. Isolation is
 * structural: this column is NOT NULL, indexed, and the repository layer is the
 * only code path allowed to read/write these tables — it injects the filter on
 * every query. See lib/db/repositories and tests/isolation.
 */
export const organisationId = () => text("organisation_id").notNull();
