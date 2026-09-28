import type { CourseAudience, SlotCode } from "@/lib/db/schema";

/**
 * Pure import parsing — no DB, no framework. Centres export their existing
 * schedule from all sorts of tools (Excel/Google Sheets, a booking system,
 * Google/Outlook calendar). We deterministically parse CSV or iCalendar into a
 * common draft shape, auto-detect columns, and flag anything uncertain so a human
 * confirms it before anything is created. This is the "check the machine's work"
 * step the workflow is built around.
 */

export interface DraftRow {
  name: string;
  date: string; // YYYY-MM-DD ("" if unparsed)
  startTime: string; // HH:MM ("" if none)
  endTime: string;
  audience: CourseAudience;
  location: string;
  staff: string;
  /** Human-readable problems that need a person to check/fix this row. */
  issues: string[];
}

export type ImportField = keyof Omit<DraftRow, "issues">;

// --- CSV ------------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c.trim() !== "")) rows.push(row); }
  return rows;
}

const HEADER_HINTS: Record<ImportField, string[]> = {
  name: ["course", "class", "activity", "session", "title", "name", "programme", "program"],
  date: ["date", "day", "when", "start date"],
  startTime: ["start", "from", "start time", "time"],
  endTime: ["end", "to", "finish", "until", "end time"],
  audience: ["audience", "age", "group", "youth/adult", "type"],
  location: ["location", "venue", "room", "classroom", "site", "place", "area"],
  staff: ["staff", "instructor", "coach", "teacher", "assigned", "leader"],
};

/** Guess which column maps to which field from header text. Returns index or -1. */
export function autoDetectColumns(headers: string[]): Record<ImportField, number> {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const out = {} as Record<ImportField, number>;
  for (const field of Object.keys(HEADER_HINTS) as ImportField[]) {
    let idx = -1;
    // exact-ish first, then contains
    for (const hint of HEADER_HINTS[field]) {
      const exact = norm.findIndex((h) => h === hint);
      if (exact !== -1) { idx = exact; break; }
    }
    if (idx === -1) {
      for (const hint of HEADER_HINTS[field]) {
        const c = norm.findIndex((h) => h.includes(hint));
        if (c !== -1) { idx = c; break; }
      }
    }
    out[field] = idx;
  }
  return out;
}

// --- value normalisers ----------------------------------------------------

/** Normalise many date spellings to YYYY-MM-DD, or "" if not confidently parsed. */
export function normaliseDate(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // DD/MM/YYYY or DD-MM-YYYY (UK default) or D/M/YY
  let m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!, mo = m[2]!;
    let y = m[3]!;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, "0"), mm = mo.padStart(2, "0");
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) return `${y}-${mm}-${dd}`;
    return "";
  }
  // "12 Jul 2026" / "12 July 2026"
  m = v.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/);
  if (m) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mi = months.indexOf(m[2]!.slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  return "";
}

/** Normalise a time to HH:MM (24h), or "" if not parsed. */
export function normaliseTime(raw: string): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  const m = v.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/);
  if (!m) return "";
  let h = Number(m[1]!);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function normaliseAudience(raw: string, name = ""): CourseAudience {
  const v = `${raw ?? ""} ${name}`.toLowerCase();
  if (/(youth|junior|kid|child|cadet|school|u1[0-8]|teen|camp)/.test(v)) return "youth";
  if (/(adult|18\+|senior)/.test(v)) return "adult";
  return "all";
}

/** Map a start time to the AM/PM/EV slot used when the centre runs on slots. */
export function timeToSlot(startTime: string): SlotCode {
  const h = startTime ? Number(startTime.slice(0, 2)) : 9;
  if (h >= 17) return "EV";
  if (h >= 12) return "PM";
  return "AM";
}

function rowIssues(r: Omit<DraftRow, "issues">): string[] {
  const issues: string[] = [];
  if (!r.name.trim()) issues.push("No course name");
  if (!r.date) issues.push("Date unclear — please set it");
  if (r.startTime && r.endTime && r.endTime <= r.startTime) issues.push("End is not after start");
  return issues;
}

/** Build reviewable draft rows from a parsed CSV grid + a column mapping. */
export function draftsFromCsv(grid: string[][], mapping: Record<ImportField, number>, hasHeader = true): DraftRow[] {
  const body = hasHeader ? grid.slice(1) : grid;
  const at = (row: string[], idx: number) => (idx >= 0 && idx < row.length ? row[idx] ?? "" : "");
  return body.map((row) => {
    const name = at(row, mapping.name).trim();
    const base = {
      name,
      date: normaliseDate(at(row, mapping.date)),
      startTime: normaliseTime(at(row, mapping.startTime)),
      endTime: normaliseTime(at(row, mapping.endTime)),
      audience: normaliseAudience(at(row, mapping.audience), name),
      location: at(row, mapping.location).trim(),
      staff: at(row, mapping.staff).trim(),
    };
    return { ...base, issues: rowIssues(base) };
  });
}

// --- iCalendar ------------------------------------------------------------

function icsDate(v: string): { date: string; time: string } {
  // Forms: 20260712T093000Z / 20260712T093000 / 20260712 (VALUE=DATE)
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return { date: "", time: "" };
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = m[4] ? `${m[4]}:${m[5]}` : "";
  return { date, time };
  // (indices 1-3 always present when matched)
}

/** Parse an .ics feed's VEVENTs into draft rows. */
export function draftsFromIcs(text: string): DraftRow[] {
  const unfolded = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
  const rows: DraftRow[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfolded.split("\n")) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) {
      if (cur) {
        const start = icsDate(cur.DTSTART ?? "");
        const end = icsDate(cur.DTEND ?? "");
        const name = (cur.SUMMARY ?? "").trim();
        const base = {
          name,
          date: start.date,
          startTime: start.time,
          endTime: end.time,
          audience: normaliseAudience("", name),
          location: (cur.LOCATION ?? "").trim(),
          staff: "",
        };
        rows.push({ ...base, issues: rowIssues(base) });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).split(";")[0]!.toUpperCase();
        cur[key] = line.slice(idx + 1);
      }
    }
  }
  return rows;
}

/** Epoch-ms from a date + HH:MM, treated as UTC (matches course_session). */
export function toEpochMs(date: string, time: string, fallbackHour = 9): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time ? time.split(":").map(Number) : [fallbackHour, 0];
  return Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
}
