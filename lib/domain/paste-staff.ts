/**
 * "Paste a list" on the Instructors page (audit follow-up): one person per
 * line, as copied from an email or a spreadsheet: "Sam Jones, sam@x.org",
 * "Sam Jones <sam@x.org>", "sam@x.org Sam Jones" or a tab between columns.
 * The email is found wherever it is; the rest is the name. Blank lines and
 * duplicate emails are dropped. Pure.
 */
export interface PastedPerson { name: string; email: string | null }

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export function parsePastedStaff(text: string, max = 200): { people: PastedPerson[]; skipped: number } {
  const people: PastedPerson[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = EMAIL.exec(line);
    const email = m ? m[0].toLowerCase() : null;
    const name = (m ? line.replace(m[0], " ") : line).replace(/[<>()"\[\]]/g, " ").replace(/[,;\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name || (email && seen.has(email)) || people.length >= max) { skipped++; continue; }
    if (email) seen.add(email);
    people.push({ name, email });
  }
  return { people, skipped };
}
