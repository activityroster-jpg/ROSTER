// Re-orders a `wrangler d1 export` file so it can be replayed into an empty D1
// database. The export writes each table followed by its rows in alphabetical
// order, so a table can arrive before the table its foreign key points at (for
// example `account` before `user`), and D1 refuses the insert ("no such table:
// main.user"). This writes: PRAGMAs, every CREATE TABLE, every INSERT, then
// indexes, views and triggers. Statements are split on semicolons outside
// quotes and comments; a trigger runs to its END. Used by restore.yml and
// restore-rehearsal.yml. Usage: node order-export.mjs in.sql out.sql
import { readFileSync, writeFileSync } from "node:fs";

export function splitStatements(sql) {
  const out = [];
  let buf = "";
  let quote = null; // ' " ` or [
  let i = 0;
  const n = sql.length;
  const flush = () => { const s = buf.trim(); if (s) out.push(s); buf = ""; };
  while (i < n) {
    const c = sql[i];
    if (quote) {
      buf += c;
      if ((quote === "[" && c === "]") || (quote !== "[" && c === quote)) {
        if (quote !== "[" && sql[i + 1] === quote) { buf += sql[i + 1]; i += 2; continue; } // escaped quote
        quote = null;
      }
      i++;
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") { const end = sql.indexOf("\n", i); i = end === -1 ? n : end + 1; buf += "\n"; continue; }
    if (c === "/" && sql[i + 1] === "*") { const end = sql.indexOf("*/", i + 2); i = end === -1 ? n : end + 2; continue; }
    if (c === "'" || c === '"' || c === "`" || c === "[") { quote = c; buf += c; i++; continue; }
    if (c === ";") {
      // A trigger body holds its own semicolons: keep going until its END.
      if (/^\s*CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(buf) && !/\bEND\s*$/i.test(buf.trim())) { buf += c; i++; continue; }
      buf += ";";
      flush();
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

export function orderExport(sql) {
  const groups = { pragma: [], table: [], insert: [], index: [], view: [], trigger: [], other: [] };
  for (const s of splitStatements(sql)) {
    const stmt = s.endsWith(";") ? s : `${s};`;
    if (/^PRAGMA\b/i.test(s)) groups.pragma.push(stmt);
    else if (/^CREATE\s+(VIRTUAL\s+)?TABLE\b/i.test(s)) groups.table.push(stmt);
    else if (/^INSERT\b/i.test(s)) groups.insert.push(stmt);
    else if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(s)) groups.index.push(stmt);
    else if (/^CREATE\s+VIEW\b/i.test(s)) groups.view.push(stmt);
    else if (/^CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(s)) groups.trigger.push(stmt);
    else if (/^(BEGIN|COMMIT|END)\b/i.test(s)) continue; // D1 manages its own transaction
    else groups.other.push(stmt);
  }
  if (!groups.pragma.some((p) => /defer_foreign_keys/i.test(p))) groups.pragma.unshift("PRAGMA defer_foreign_keys = true;");
  // Tables (and their rows) in foreign-key order, parents first, so the file
  // loads even where foreign keys are checked row by row.
  const order = dependencyOrder(groups.table);
  const rank = (t) => order.get(t) ?? Number.MAX_SAFE_INTEGER;
  const tableOf = (stmt, re) => (re.exec(stmt)?.[1] ?? "").replace(/^["`[]|["`\]]$/g, "");
  const byRank = (re) => (a, b) => rank(tableOf(a, re)) - rank(tableOf(b, re));
  const tables = [...groups.table].sort(byRank(TABLE_RE));
  const inserts = groups.insert.map((s, i) => [s, i]).sort((a, b) => byRank(INSERT_RE)(a[0], b[0]) || a[1] - b[1]).map(([s]) => s);
  return { sql: [...groups.pragma, ...tables, ...inserts, ...groups.other, ...groups.index, ...groups.view, ...groups.trigger].join("\n") + "\n", counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])) };
}

const TABLE_RE = /^CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)/i;
const INSERT_RE = /^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)/i;
const REF_RE = /REFERENCES\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)/gi;
const bare = (n) => n.replace(/^["`[]|["`\]]$/g, "");

/** Parents before children; a cycle or self-reference keeps the remaining tables in file order. */
function dependencyOrder(createTables) {
  const deps = new Map();
  for (const s of createTables) {
    const name = bare(TABLE_RE.exec(s)?.[1] ?? "");
    if (!name) continue;
    const refs = new Set([...s.matchAll(REF_RE)].map((m) => bare(m[1])).filter((r) => r !== name));
    deps.set(name, refs);
  }
  const order = new Map();
  const done = new Set();
  let progress = true;
  while (done.size < deps.size && progress) {
    progress = false;
    for (const [name, refs] of deps) {
      if (done.has(name)) continue;
      if ([...refs].every((r) => done.has(r) || !deps.has(r))) { order.set(name, order.size); done.add(name); progress = true; }
    }
  }
  for (const name of deps.keys()) if (!done.has(name)) order.set(name, order.size);
  return order;
}

if (process.argv[1] && process.argv[1].endsWith("order-export.mjs")) {
  const [, , input, output] = process.argv;
  const { sql, counts } = orderExport(readFileSync(input, "utf8"));
  writeFileSync(output, sql);
  console.log(`Re-ordered: ${counts.table} tables, ${counts.insert} rows, ${counts.index} indexes, ${counts.trigger} triggers, ${counts.other} other.`);
}
