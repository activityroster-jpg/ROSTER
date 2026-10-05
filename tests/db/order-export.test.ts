import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db";
import { seedFullOrg } from "../helpers/seed-fixtures";
// @ts-expect-error plain ESM script without types, shared with the restore workflows
import { orderExport, splitStatements } from "../../.github/scripts/order-export.mjs";

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

/** A dump laid out like `wrangler d1 export`: tables alphabetically, each followed by its rows, then indexes and triggers. */
function wranglerStyleDump(raw: Database.Database): string {
  const lines = ["PRAGMA defer_foreign_keys=TRUE;"];
  const tables = raw.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string; sql: string }[];
  for (const t of tables) {
    lines.push(`${t.sql};`);
    for (const row of raw.prepare(`SELECT * FROM "${t.name}"`).all() as Record<string, unknown>[]) {
      lines.push(`INSERT INTO "${t.name}" (${Object.keys(row).map((c) => `"${c}"`).join(",")}) VALUES(${Object.values(row).map(q).join(",")});`);
    }
  }
  for (const r of raw.prepare("SELECT sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL").all() as { sql: string }[]) lines.push(`${r.sql};`);
  return lines.join("\n");
}

function counts(raw: Database.Database): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { name } of raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
    out[name] = (raw.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
  }
  return out;
}

function replay(sql: string): Database.Database {
  const fresh = new Database(":memory:");
  fresh.pragma("foreign_keys = ON");
  // Statement by statement, outside a transaction: foreign keys are checked row by row.
  for (const s of splitStatements(sql) as string[]) if (!/^PRAGMA/i.test(s)) fresh.exec(s);
  return fresh;
}

describe("re-ordering a database export so it restores", () => {
  it("the raw alphabetical export fails, the re-ordered one restores every row", async () => {
    const { db, raw } = createTestDb();
    await seedFullOrg(db, { name: "Yeadon", slug: "yeadon", jurisdiction: "england" });
    const dump = wranglerStyleDump(raw);

    expect(() => replay(dump)).toThrow();

    const restored = replay(orderExport(dump).sql);
    expect(counts(restored)).toEqual(counts(raw));
    // Triggers come back too (the append-only log guard).
    const triggers = (restored.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get() as { n: number }).n;
    expect(triggers).toBe((raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get() as { n: number }).n);
  });

  it("splits on semicolons only outside strings, comments and trigger bodies", () => {
    const sql = `INSERT INTO "a" VALUES('x; y', 'it''s; fine');\n-- note; here\nCREATE TRIGGER t BEFORE DELETE ON a BEGIN SELECT RAISE(ABORT, 'no; never'); END;\nCREATE TABLE "b" ("v" TEXT DEFAULT ';');`;
    expect(splitStatements(sql)).toEqual([
      `INSERT INTO "a" VALUES('x; y', 'it''s; fine');`,
      `CREATE TRIGGER t BEFORE DELETE ON a BEGIN SELECT RAISE(ABORT, 'no; never'); END;`,
      `CREATE TABLE "b" ("v" TEXT DEFAULT ';');`,
    ]);
  });
});
