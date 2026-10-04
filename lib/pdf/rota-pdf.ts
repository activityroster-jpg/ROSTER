import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { shortNames, type RotaStyle, type RotaTemplateSettings } from "@/lib/rota/template";

/**
 * The rota as a real PDF, drawn with pdf-lib (pure JavaScript, runs on
 * Workers): no browser print, no screenshot.
 *
 * It is a full breakdown of each day: one table per day, a row per course
 * (session), with the course name on the left, then the times, then who is
 * working, then whichever extras the centre ticked (students, location, equipment).
 * Vertical is a portrait page; horizontal is the same breakdown on a
 * landscape page, which gives the staff and extras columns more room.
 *
 * The centre's chosen style (classic, bold, minimal, compact) sets the
 * colours, weights and density. Staff appear by first name, with a surname
 * initial only where two people on the document share a first name.
 */

export interface RotaPdfInput {
  centreName: string;
  title: string;
  days: RotaDay[];
  template: RotaTemplateSettings;
  generatedAt?: Date;
  timeZone?: string;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 36; // margin
const NAVY = rgb(0.067, 0.133, 0.25);
const TEAL = rgb(0.047, 0.42, 0.455);
const SLATE = rgb(0.4, 0.45, 0.52);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.1, 0.1, 0.1);

interface Look {
  size: number; lh: number; pad: number;
  text: RGB; muted: RGB; rule: RGB;
  dayFill: RGB | null; dayText: RGB; dayH: number;
  colFill: RGB | null; colText: RGB;
  zebra: RGB | null;
  accent: RGB | null; // a thin bar at the left of each row
}

const LOOKS: Record<RotaStyle, Look> = {
  classic: { size: 9, lh: 11.5, pad: 4, text: NAVY, muted: SLATE, rule: rgb(0.85, 0.88, 0.92), dayFill: rgb(0.95, 0.97, 0.98), dayText: NAVY, dayH: 18, colFill: null, colText: SLATE, zebra: null, accent: null },
  bold: { size: 9, lh: 11.5, pad: 4.5, text: NAVY, muted: SLATE, rule: rgb(0.8, 0.84, 0.9), dayFill: NAVY, dayText: WHITE, dayH: 20, colFill: rgb(0.047, 0.42, 0.455), colText: WHITE, zebra: rgb(0.96, 0.98, 0.98), accent: TEAL },
  minimal: { size: 9, lh: 11.5, pad: 4, text: BLACK, muted: rgb(0.35, 0.35, 0.35), rule: rgb(0.75, 0.75, 0.75), dayFill: null, dayText: BLACK, dayH: 18, colFill: null, colText: rgb(0.35, 0.35, 0.35), zebra: null, accent: null },
  compact: { size: 7.8, lh: 9.6, pad: 2.5, text: NAVY, muted: SLATE, rule: rgb(0.85, 0.88, 0.92), dayFill: rgb(0.95, 0.97, 0.98), dayText: NAVY, dayH: 15, colFill: null, colText: SLATE, zebra: rgb(0.975, 0.98, 0.985), accent: null },
};

/** Standard PDF fonts only know WinAnsi; swap anything else for a safe character. */
function safe(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x7f || (c >= 0xa0 && c <= 0xff) || "–—‘’“”•…€™×".includes(ch)) out += ch;
    else if (c === 0x2192) out += "->";
    else out += "?";
  }
  return out;
}

function clock(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  // A single word wider than the column is clipped rather than overflowing.
  return lines.map((l) => { let s = l; while (s.length > 1 && font.widthOfTextAtSize(s, size) > width) s = s.slice(0, -1); return s === l ? l : `${s.slice(0, -1)}…`; });
}

interface Ctx { doc: PDFDocument; font: PDFFont; bold: PDFFont; page: PDFPage; y: number; w: number; h: number; landscape: boolean; title: string; centre: string; stamp: string; pageNo: number; look: Look }

function newPage(c: Ctx): void {
  c.page = c.doc.addPage(c.landscape ? [A4.h, A4.w] : [A4.w, A4.h]);
  c.w = c.page.getWidth(); c.h = c.page.getHeight();
  c.pageNo++;
  const L = c.look;
  c.page.drawText(safe(c.centre), { x: M, y: c.h - M - 4, size: 15, font: c.bold, color: L.text });
  c.page.drawText(safe(c.title), { x: M, y: c.h - M - 22, size: 10.5, font: c.font, color: L.muted });
  const right = safe(`Generated ${c.stamp} · page ${c.pageNo}`);
  c.page.drawText(right, { x: c.w - M - c.font.widthOfTextAtSize(right, 8), y: c.h - M - 4, size: 8, font: c.font, color: L.muted });
  c.page.drawLine({ start: { x: M, y: c.h - M - 30 }, end: { x: c.w - M, y: c.h - M - 30 }, thickness: 1, color: L.rule });
  c.y = c.h - M - 44;
  const foot = safe("Produced by ActivityRoster · planning aid, not legal advice · check the live rota for late changes");
  c.page.drawText(foot, { x: M, y: M - 14, size: 7, font: c.font, color: L.muted });
}

function ensure(c: Ctx, needed: number): void { if (c.y - needed < M) newPage(c); }

interface Col { key: "course" | "times" | "staff" | "students" | "where" | "kit"; label: string; w: number; weight: number }

/** The columns, in the order the centre reads them: course, times, staff, then the extras. */
export function rotaColumns(t: RotaTemplateSettings): { key: Col["key"]; label: string }[] {
  const f = t.fields;
  const cols: { key: Col["key"]; label: string }[] = [{ key: "course", label: "Course" }];
  if (f.times) cols.push({ key: "times", label: "Times" });
  if (f.instructors) cols.push({ key: "staff", label: f.roles ? "Staff working (role)" : "Staff working" });
  if (f.students) cols.push({ key: "students", label: "Students" });
  if (f.locations) cols.push({ key: "where", label: "Location" });
  if (f.equipment) cols.push({ key: "kit", label: "Equipment" });
  return cols;
}

/** Cell text for one session: each staff member on their own line. */
function cell(key: Col["key"], s: RotaSession, t: RotaTemplateSettings, names: Map<string, string>, tz: string): string[] {
  switch (key) {
    case "course": return [s.courseName];
    case "times": return [`${clock(s.startAt, tz)} – ${clock(s.endAt, tz)}`];
    case "staff": {
      const who = s.staff.filter((x) => x.status !== "declined").map((x) => (t.fields.roles ? `${names.get(x.name) ?? x.name} (${x.role})` : names.get(x.name) ?? x.name));
      return who.length ? who : ["Unassigned"];
    }
    case "students": return [s.students > 0 ? String(s.students) : "—"];
    case "where": return s.locations.length ? [s.locations.join(", ")] : ["—"];
    case "kit": return s.equipment.length ? [s.equipment.join(", ")] : ["—"];
  }
}

export async function renderRotaPdf(input: RotaPdfInput): Promise<Uint8Array> {
  const tz = input.timeZone ?? "Europe/London";
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.centreName} rota – ${input.title}`);
  doc.setProducer("ActivityRoster");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const stamp = (input.generatedAt ?? new Date()).toLocaleString("en-GB", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
  const names = shortNames(input.days.flatMap((d) => d.sessions.flatMap((s) => s.staff.map((x) => x.name))));
  const landscape = input.template.orientation === "horizontal";
  const look = LOOKS[input.template.style] ?? LOOKS.classic;
  const c: Ctx = { doc, font, bold, page: undefined as unknown as PDFPage, y: 0, w: 0, h: 0, landscape, title: input.title, centre: input.centreName, stamp, pageNo: 0, look };
  newPage(c);

  const total = input.days.reduce((n, d) => n + d.sessions.length, 0);
  if (total === 0) {
    c.page.drawText(safe("Nothing rostered in this period yet."), { x: M, y: c.y - 10, size: 11, font, color: look.muted });
    return doc.save();
  }
  drawBreakdown(c, input, names, tz);
  return doc.save();
}

/** Column widths: times fixed, the rest share the page with staff and course given more room. */
function layoutColumns(t: RotaTemplateSettings, inner: number, look: Look, font: PDFFont): Col[] {
  const cols: Col[] = rotaColumns(t).map((col) => ({ ...col, w: 0, weight: col.key === "staff" ? 1.5 : col.key === "course" ? 1.3 : col.key === "kit" ? 0.9 : 0.9 }));
  const timesW = font.widthOfTextAtSize("00:00 – 00:00", look.size) + 2 * look.pad + 6;
  const studentsW = font.widthOfTextAtSize("Students", look.size - 1) + 2 * look.pad + 6;
  for (const col of cols) { if (col.key === "times") col.w = timesW; if (col.key === "students") col.w = studentsW; }
  const flex = cols.filter((col) => col.key !== "times" && col.key !== "students");
  const free = inner - cols.reduce((n, col) => n + col.w, 0);
  const weight = flex.reduce((n, col) => n + col.weight, 0);
  for (const col of flex) col.w = (free * col.weight) / weight;
  return cols;
}

function drawBreakdown(c: Ctx, input: RotaPdfInput, names: Map<string, string>, tz: string): void {
  const L = c.look;
  const inner = c.w - 2 * M;
  const cols = layoutColumns(input.template, inner, L, c.font);
  const { size, lh, pad } = L;

  const drawColumnHeader = () => {
    const h = size + 2 * pad + 1;
    if (L.colFill) c.page.drawRectangle({ x: M, y: c.y - h, width: inner, height: h, color: L.colFill });
    let x = M;
    for (const col of cols) { c.page.drawText(col.label, { x: x + pad, y: c.y - pad - size + 1, size: size - 1, font: c.bold, color: L.colText }); x += col.w; }
    c.y -= h;
    c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + inner, y: c.y }, thickness: 0.8, color: L.rule });
  };

  for (const day of input.days) {
    // A month skips its empty days; a day or week shows them so the gap is visible.
    if (input.template.range === "month" && day.sessions.length === 0) continue;
    ensure(c, L.dayH + size + 2 * pad + 30);
    if (L.dayFill) c.page.drawRectangle({ x: M, y: c.y - L.dayH, width: inner, height: L.dayH, color: L.dayFill });
    const count = day.sessions.length ? `${day.sessions.length} course${day.sessions.length === 1 ? "" : "s"}` : "No courses";
    c.page.drawText(safe(day.label), { x: M + 6, y: c.y - L.dayH + (L.dayH - size - 1.5) / 2, size: size + 1.5, font: c.bold, color: L.dayText });
    c.page.drawText(count, { x: M + inner - 6 - c.font.widthOfTextAtSize(count, size - 1), y: c.y - L.dayH + (L.dayH - size + 1) / 2, size: size - 1, font: c.font, color: L.dayFill && L.dayText === WHITE ? rgb(0.85, 0.9, 0.95) : L.muted });
    c.y -= L.dayH + 2;
    if (!L.dayFill) { c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + inner, y: c.y }, thickness: 1.2, color: L.text }); c.y -= 2; }
    if (day.sessions.length === 0) { c.y -= 10; continue; }
    drawColumnHeader();

    day.sessions.forEach((s, idx) => {
      const cells = cols.map((col) => cell(col.key, s, input.template, names, tz).flatMap((line) => wrap(line, c.font, size, col.w - 2 * pad)));
      const rows = Math.max(1, ...cells.map((cl) => cl.length));
      const rowH = rows * lh + 2 * pad;
      if (c.y - rowH < M) { newPage(c); drawColumnHeader(); }
      if (L.zebra && idx % 2 === 1) c.page.drawRectangle({ x: M, y: c.y - rowH, width: inner, height: rowH, color: L.zebra });
      if (L.accent) c.page.drawRectangle({ x: M, y: c.y - rowH, width: 2, height: rowH, color: L.accent });
      let x = M;
      cells.forEach((cl, i) => {
        const isCourse = cols[i]!.key === "course";
        cl.forEach((line, j) => c.page.drawText(line, { x: x + pad + (isCourse && L.accent ? 3 : 0), y: c.y - pad - lh * (j + 1) + 3, size, font: isCourse ? c.bold : c.font, color: L.text }));
        x += cols[i]!.w;
      });
      c.y -= rowH;
      c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + inner, y: c.y }, thickness: 0.5, color: L.rule });
    });
    c.y -= 12;
  }
}
