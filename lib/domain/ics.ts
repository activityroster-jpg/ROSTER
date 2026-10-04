/**
 * A minimal iCalendar (RFC 5545) writer for an instructor's own shifts.
 * Times are floating wall-clock values (no time zone), matching the rule that
 * a session is whatever time was typed: 09:00 shows as 09:00 in any calendar.
 * Pure: no I/O, no clock unless passed.
 */

export interface IcsEvent {
  uid: string;
  /** Wall-clock instants stored as UTC (the app's convention). */
  startAt: number;
  endAt: number;
  summary: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
}

/** Escape text per RFC 5545 §3.3.11. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (§3.1); continuation lines start with a space. */
export function icsFold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (curLen + n > limit) { out.push(cur); cur = ""; curLen = 0; }
    cur += ch; curLen += n;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Floating local time: what was typed, no Z, no TZID. */
export function icsFloating(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}
/** A real instant in UTC (for DTSTAMP). */
export function icsUtc(ms: number): string {
  return `${icsFloating(ms)}Z`;
}

export function buildIcs(calendarName: string, events: readonly IcsEvent[], now: number): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ActivityRoster//Roster//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsEscape(e.uid)}`,
      `DTSTAMP:${icsUtc(now)}`,
      `DTSTART:${icsFloating(e.startAt)}`,
      `DTEND:${icsFloating(e.endAt)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
      `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
