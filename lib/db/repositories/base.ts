import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database } from "@/lib/db/client";
import { isGhostContext, isReadOnlyContext, type AnyTenantContext } from "@/lib/tenant/context";
import { GhostReadOnlyError } from "@/lib/auth/ghost";
import { TrialReadOnlyError } from "@/lib/billing/trial";

/**
 * A tenant-owned table must expose an `id` and an `organisationId` column.
 * These are the two columns the repository relies on for scoping.
 */
export type TenantTable = SQLiteTable & {
  id: SQLiteColumn;
  organisationId: SQLiteColumn;
};

/**
 * THE ONLY path to tenant data.
 *
 * Every method takes a {@link AnyTenantContext} and injects
 * `organisation_id = ctx.organisationId` into every read and write. On insert
 * the org id is FORCED from the context — a caller cannot smuggle a different
 * org id through the payload. There is deliberately no "unscoped" escape hatch.
 *
 * The cross-tenant isolation test (tests/isolation) exercises this contract:
 * seed two orgs, then assert no repository call can read or mutate the other
 * org's rows.
 */
export class TenantRepository<T extends TenantTable> {
  constructor(
    protected readonly db: Database,
    protected readonly table: T,
  ) {}

  /** Ghost Mode and lapsed-trial contexts can read everything and write nothing — enforced here, not by vigilance. */
  protected assertWritable(ctx: AnyTenantContext): void {
    if (isGhostContext(ctx)) throw new GhostReadOnlyError();
    if (isReadOnlyContext(ctx)) throw new TrialReadOnlyError();
  }

  /** WHERE clause pinning to this tenant, optionally AND-ed with more. */
  protected scoped(ctx: AnyTenantContext, extra?: SQL | undefined): SQL {
    const orgFilter = eq(this.table.organisationId, ctx.organisationId);
    return extra ? (and(orgFilter, extra) as SQL) : orgFilter;
  }

  /** List every row owned by the tenant (optionally further filtered). */
  async list(ctx: AnyTenantContext, where?: SQL): Promise<T["$inferSelect"][]> {
    const rows = await this.db.select().from(this.table as SQLiteTable).where(this.scoped(ctx, where));
    return rows as T["$inferSelect"][];
  }

  /** Find one row by id, but ONLY if it belongs to the tenant. */
  async findById(ctx: AnyTenantContext, id: string): Promise<T["$inferSelect"] | null> {
    const rows = await this.db
      .select()
      .from(this.table as SQLiteTable)
      .where(this.scoped(ctx, eq(this.table.id, id)))
      .limit(1);
    return (rows[0] as T["$inferSelect"] | undefined) ?? null;
  }

  /**
   * Insert a row. The org id is taken from the context and overrides anything
   * in `values`, so a payload can never write into another tenant.
   */
  async insert(
    ctx: AnyTenantContext,
    values: Omit<T["$inferInsert"], "organisationId">,
  ): Promise<T["$inferSelect"]> {
    this.assertWritable(ctx);
    const row = { ...values, organisationId: ctx.organisationId } as T["$inferInsert"];
    const inserted = await this.db.insert(this.table).values(row).returning();
    return (inserted as T["$inferSelect"][])[0]!;
  }

  /**
   * Build (but don't run) an insert, with the org id forced from the context,
   * for {@link runAtomic}. The caller supplies the id when later statements in
   * the same batch refer to this row.
   */
  insertStatement(ctx: AnyTenantContext, values: Omit<T["$inferInsert"], "organisationId">) {
    this.assertWritable(ctx);
    return this.db.insert(this.table).values({ ...values, organisationId: ctx.organisationId } as T["$inferInsert"]);
  }

  /** Insert many rows, each forced into this tenant. */
  async insertMany(
    ctx: AnyTenantContext,
    rows: Omit<T["$inferInsert"], "organisationId">[],
  ): Promise<T["$inferSelect"][]> {
    this.assertWritable(ctx);
    if (rows.length === 0) return [];
    const withOrg = rows.map((r) => ({ ...r, organisationId: ctx.organisationId })) as T["$inferInsert"][];
    // D1 allows 100 bound parameters per statement; ten rows of any tenant
    // table stays comfortably under that.
    const CHUNK = 10;
    const out: T["$inferSelect"][] = [];
    for (let i = 0; i < withOrg.length; i += CHUNK) {
      const inserted = await this.db.insert(this.table).values(withOrg.slice(i, i + CHUNK)).returning();
      out.push(...(inserted as T["$inferSelect"][]));
    }
    return out;
  }

  /**
   * Insert a row, or update the matching one when a unique key already holds it.
   * `target` names the unique index's columns (and `targetWhere` its partial
   * condition); `set` is what changes on conflict. The org id is forced from the
   * context on insert and the update is pinned to this tenant too, so a key held
   * by another org's row is never touched.
   */
  async upsert(
    ctx: AnyTenantContext,
    values: Omit<T["$inferInsert"], "organisationId">,
    conflict: { target: SQLiteColumn[]; targetWhere?: SQL },
    set: Partial<Omit<T["$inferInsert"], "organisationId" | "id">>,
  ): Promise<T["$inferSelect"]> {
    this.assertWritable(ctx);
    const row = { ...values, organisationId: ctx.organisationId } as T["$inferInsert"];
    const { organisationId: _drop, id: _dropId, ...safe } = set as Record<string, unknown>;
    void _drop;
    void _dropId;
    const out = await this.db
      .insert(this.table)
      .values(row)
      .onConflictDoUpdate({
        target: conflict.target,
        ...(conflict.targetWhere ? { targetWhere: conflict.targetWhere } : {}),
        set: safe as Partial<T["$inferInsert"]>,
        setWhere: eq(this.table.organisationId, ctx.organisationId),
      })
      .returning();
    return (out as T["$inferSelect"][])[0]!;
  }

  /**
   * Update a row by id, scoped to the tenant. Returns the updated row, or null
   * if no row with that id belongs to the tenant (so cross-tenant updates are a
   * silent no-op that returns null rather than touching another org's data).
   * `organisationId` is stripped from the patch so it can never be reassigned.
   */
  async update(
    ctx: AnyTenantContext,
    id: string,
    patch: Partial<Omit<T["$inferInsert"], "organisationId" | "id">>,
  ): Promise<T["$inferSelect"] | null> {
    this.assertWritable(ctx);
    const { organisationId: _drop, id: _dropId, ...safe } = patch as Record<string, unknown>;
    void _drop;
    void _dropId;
    const updated = await this.db
      .update(this.table)
      .set(safe as Partial<T["$inferInsert"]>)
      .where(this.scoped(ctx, eq(this.table.id, id)))
      .returning();
    return (updated as T["$inferSelect"][])[0] ?? null;
  }

  /** Delete a row by id, scoped to the tenant. Returns rows removed (0 or 1). */
  async delete(ctx: AnyTenantContext, id: string): Promise<number> {
    this.assertWritable(ctx);
    const removed = await this.db
      .delete(this.table)
      .where(this.scoped(ctx, eq(this.table.id, id)))
      .returning();
    return (removed as unknown[]).length;
  }

  /**
   * Delete EVERY row this tenant owns in this table. Used only by GDPR erasure,
   * which calls the tables in dependency order so RESTRICT foreign keys between
   * tenant tables are satisfied. Still fully org-scoped.
   */
  async deleteAllForOrg(ctx: AnyTenantContext): Promise<number> {
    this.assertWritable(ctx);
    const removed = await this.db.delete(this.table).where(this.scoped(ctx)).returning();
    return (removed as unknown[]).length;
  }

  /** Count rows owned by the tenant (optionally further filtered). */
  async count(ctx: AnyTenantContext, where?: SQL): Promise<number> {
    const rows = await this.db
      .select({ id: this.table.id })
      .from(this.table as SQLiteTable)
      .where(this.scoped(ctx, where));
    return rows.length;
  }
}
