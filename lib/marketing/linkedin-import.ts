import type { LinkedinContact } from "@/lib/marketing";

/**
 * Pure helpers for importing LinkedIn research from a spreadsheet (saved as
 * CSV): one row per centre with its company page and up to three people.
 * Columns are found by their header, so extra columns are ignored.
 */
export interface LinkedinImportRow { name: string; postcode: string; pageUrl: string; contacts: LinkedinContact[] }

const MAX_CONTACTS = 20;
const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const isLinkedin = (v: string) => /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\//i.test(v);
const withScheme = (v: string) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);
const linkOrBlank = (v: string | undefined) => { const u = clean(v, 300); return isLinkedin(u) ? withScheme(u) : ""; };
export const normName = (v: string) => v.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
export const normPostcode = (v: string) => v.toUpperCase().replace(/\s+/g, "");

/** Read the header row and pull out each centre's page and people. Rows with nothing to add are dropped. */
export function parseLinkedinSheet(grid: string[][]): LinkedinImportRow[] {
  if (grid.length < 2) return [];
  const head = grid[0]!.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const name = col("name", "centre", "center");
  if (name < 0) return [];
  const postcode = col("postcode", "post code");
  const page = col("linkedin", "linkedin url", "company linkedin");
  const people = [
    { n: col("contact", "contact 1"), r: col("role", "contact role", "contact 1 role"), u: col("contact linkedin", "contact 1 linkedin"), c: col("contact confidence", "contact 1 confidence") },
    { n: col("contact 2"), r: col("contact 2 role"), u: col("contact 2 linkedin"), c: col("contact 2 confidence") },
    { n: col("contact 3"), r: col("contact 3 role"), u: col("contact 3 linkedin"), c: col("contact 3 confidence") },
  ];
  const at = (line: string[], i: number) => (i >= 0 ? line[i] ?? "" : "");
  const out: LinkedinImportRow[] = [];
  for (const line of grid.slice(1)) {
    const n = clean(at(line, name), 200);
    if (!n) continue;
    const contacts: LinkedinContact[] = [];
    for (const p of people) {
      const cn = clean(at(line, p.n), 120);
      const url = linkOrBlank(at(line, p.u));
      if (!cn && !url) continue;
      const unsure = clean(at(line, p.c), 20).toLowerCase() === "low";
      const role = clean(at(line, p.r), unsure ? 106 : 120);
      contacts.push({ name: cn, role: unsure ? `${role}${role ? " " : ""}(unconfirmed)` : role, url });
    }
    const pageUrl = linkOrBlank(at(line, page));
    if (!pageUrl && contacts.length === 0) continue;
    out.push({ name: n, postcode: clean(at(line, postcode), 12), pageUrl, contacts });
  }
  return out;
}

/** The prospect a row belongs to: same name; if several share it, the one with the same postcode. */
export function matchProspect<P extends { id: string; name: string; postcode: string | null }>(row: LinkedinImportRow, byName: Map<string, P[]>): P | null {
  const list = byName.get(normName(row.name)) ?? [];
  if (list.length <= 1) return list[0] ?? null;
  const pc = normPostcode(row.postcode);
  return (pc && list.find((p) => normPostcode(p.postcode ?? "") === pc)) || null;
}

/** Add the sheet's page and people to what is already there. The sheet's page wins; people are added, never removed or duplicated. */
export function mergeLinkedin(current: { pageUrl: string; contacts: LinkedinContact[] }, row: LinkedinImportRow): { pageUrl: string; contacts: LinkedinContact[]; added: number; pageChanged: boolean } {
  const pageUrl = row.pageUrl || current.pageUrl;
  const contacts = [...current.contacts];
  const sameUrl = (a: string, b: string) => Boolean(a && b) && a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();
  let added = 0;
  for (const c of row.contacts) {
    const i = contacts.findIndex((x) => sameUrl(x.url, c.url) || (Boolean(c.name && x.name) && normName(x.name) === normName(c.name)));
    if (i >= 0) {
      // Already listed: only fill in a missing link or role.
      const x = contacts[i]!;
      if ((!x.url && c.url) || (!x.role && c.role)) { contacts[i] = { name: x.name || c.name, role: x.role || c.role, url: x.url || c.url }; added++; }
      continue;
    }
    if (contacts.length >= MAX_CONTACTS) continue;
    contacts.push(c);
    added++;
  }
  return { pageUrl, contacts, added, pageChanged: pageUrl !== current.pageUrl };
}
