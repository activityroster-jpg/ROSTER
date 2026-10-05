// Restore rehearsal checks (used by .github/workflows/restore-rehearsal.yml).
// Compares every table's row count in the restored throwaway database with the
// number of rows in the backup file, then (for information only) with
// production now. Writes a table to the run summary and the totals to outputs.
// Prints counts only: never row contents.
import { execFileSync } from "node:child_process";
import { readFileSync, appendFileSync } from "node:fs";
import { splitStatements } from "./order-export.mjs";

const fail = (msg) => { console.log(`::error::${String(msg).slice(0, 400)}`); process.exit(1); };
process.on("uncaughtException", (e) => {
  const out = String(e?.stdout ?? "");
  let msg = "";
  try {
    const j = JSON.parse(out.slice(out.indexOf("{")));
    msg = [j?.error?.text, ...(j?.error?.notes ?? []).map((n) => n?.text)].filter(Boolean).join(" | ");
  } catch { /* not JSON */ }
  if (!msg) msg = `${out}\n${e?.stderr ?? ""}`.split("\n").find((l) => /ERROR|rror/.test(l)) ?? e?.message ?? String(e);
  fail(`Row-count check crashed: ${msg.replace(/\x1b\[[0-9;]*m/g, "").trim()}`);
});

const [, , backupFile, scratch, config] = process.argv;

function run(db, sql, extra = []) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", db, ...extra, "--remote", "--json", "--command", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf("[")));
}
const query = (db, sql, extra = []) => run(db, sql, extra)[0].results;

// Rows per table in the backup file: one INSERT statement per row.
const expected = new Map();
for (const stmt of splitStatements(readFileSync(backupFile, "utf8"))) {
  const m = /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`[]?([A-Za-z0-9_]+)/i.exec(stmt);
  if (m && !/^sqlite_|^_cf_/.test(m[1])) expected.set(m[1], (expected.get(m[1]) ?? 0) + 1);
}

const tables = query(scratch, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name", ["-c", config]).map((r) => r.name);
/** Row counts: one small SELECT per table, twenty statements per request (D1 refuses long compound SELECTs). */
function countAll(db, names, extra = []) {
  const out = new Map();
  for (let i = 0; i < names.length; i += 20) {
    const chunk = names.slice(i, i + 20);
    for (const set of run(db, chunk.map((t) => `SELECT '${t}' AS t, COUNT(*) AS n FROM "${t}";`).join(" "), extra)) for (const r of set.results ?? []) out.set(r.t, Number(r.n));
  }
  return out;
}
const restored = countAll(scratch, tables, ["-c", config]);

let prod = new Map();
try {
  const prodTables = new Set(query("activityroster", "SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name));
  prod = countAll("activityroster", tables.filter((t) => prodTables.has(t)));
} catch { /* information only */ }

const mismatches = [];
let rows = 0;
const lines = ["| Table | In backup file | Restored | Production now |", "|---|---:|---:|---:|"];
for (const t of new Set([...expected.keys(), ...tables])) {
  const want = expected.get(t) ?? 0;
  const got = restored.get(t);
  rows += got ?? 0;
  if (got === undefined || got !== want) mismatches.push(`${t}: file ${want}, restored ${got ?? "missing"}`);
  lines.push(`| ${t} | ${want} | ${got ?? "missing"} | ${prod.get(t) ?? "–"} |`);
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) appendFileSync(summary, `\n#### Row counts\n\n${lines.join("\n")}\n\n${mismatches.length ? `**${mismatches.length} table(s) did not match.**` : "Every table matched the backup file."}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tables=${tables.length}\nrows=${rows}\n`);
console.log(`${tables.length} tables, ${rows} rows restored; ${mismatches.length} mismatch(es).`);
if (mismatches.length) {
  for (const m of mismatches.slice(0, 10)) console.log(`::error::Row count differs: ${m}`);
  process.exit(1);
}
