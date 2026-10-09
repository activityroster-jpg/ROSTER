import { parseCsv } from "./parse";

/**
 * Tolerant staff (instructor) import from a spreadsheet. Real centre lists are
 * messy and incomplete — only a name is required; everything else is optional
 * and flagged, never blocking. Quals and courses are free text (comma or
 * semicolon separated) matched to your catalogue on import.
 */
export type StaffField = "name" | "email" | "phone" | "employment" | "quals" | "courses";

export const STAFF_FIELD_LABELS: Record<StaffField, string> = {
  name: "Full name",
  email: "Email",
  phone: "Phone",
  employment: "Employment",
  quals: "Qualifications / licences",
  courses: "Courses they can teach",
};

export interface DraftStaff {
  name: string;
  email: string;
  phone: string;
  employment: string;
  quals: string;
  courses: string;
  issues: string[];
}

const HEADER_HINTS: Record<StaffField, string[]> = {
  name: ["name", "full name", "instructor", "staff", "person"],
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "mobile", "tel", "contact"],
  employment: ["employment", "type", "role", "status", "contract"],
  quals: ["qual", "ticket", "licence", "license", "cert", "award", "grade"],
  courses: ["course", "teach", "can teach", "discipline", "scheme"],
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Best-guess column index per field from the header row (−1 if not found). */
export function autoDetectStaffColumns(headers: string[]): Record<StaffField, number> {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const out = { name: -1, email: -1, phone: -1, employment: -1, quals: -1, courses: -1 } as Record<StaffField, number>;
  (Object.keys(HEADER_HINTS) as StaffField[]).forEach((field) => {
    const hints = HEADER_HINTS[field];
    let best = -1;
    norm.forEach((h, i) => {
      if (best === -1 && hints.some((hint) => h.includes(hint))) best = i;
    });
    out[field] = best;
  });
  // "courses" and "quals" can collide on the word "course"; prefer the more specific.
  if (out.courses !== -1 && out.courses === out.quals) out.quals = -1;
  return out;
}

export function normaliseEmployment(raw: string): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (/volunt/.test(v)) return "volunteer";
  if (/free|self|contract|casual/.test(v)) return "freelance";
  if (/employ|staff|paye|full|part/.test(v)) return "employed";
  return "employed";
}

function issuesFor(d: Omit<DraftStaff, "issues">): string[] {
  const out: string[] = [];
  if (!d.name.trim()) out.push("No name — this row will be skipped");
  if (d.email && !EMAIL_RE.test(d.email)) out.push("Email looks invalid");
  if (!d.email) out.push("No email — can't send an invite (add later)");
  return out;
}

/** Build tolerant staff drafts from a parsed CSV grid + column mapping. */
export function draftsStaffFromCsv(grid: string[][], mapping: Record<StaffField, number>, hasHeader = true): DraftStaff[] {
  const rows = hasHeader ? grid.slice(1) : grid;
  const pick = (row: string[], field: StaffField) => {
    const idx = mapping[field];
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };
  const out: DraftStaff[] = [];
  for (const row of rows) {
    if (row.every((c) => !c || !c.trim())) continue; // blank line
    const base = {
      name: pick(row, "name"),
      email: pick(row, "email").toLowerCase(),
      phone: pick(row, "phone"),
      employment: normaliseEmployment(pick(row, "employment")),
      quals: pick(row, "quals"),
      courses: pick(row, "courses"),
    };
    out.push({ ...base, issues: issuesFor(base) });
  }
  return out;
}

/** Split a free-text list ("Dinghy L2; First Aid, Powerboat") into trimmed items. */
export function splitList(raw: string): string[] {
  return (raw ?? "").split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean);
}

export { parseCsv };
