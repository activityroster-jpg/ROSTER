import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { shortNames, type RotaTemplateSettings } from "@/lib/rota/template";

/**
 * A real PDF of the rota, drawn with pdf-lib (pure JavaScript, runs on
 * Workers): no browser print, no screenshot. Two layouts:
 *
 *   vertical   — portrait A4; one table per day, a row per session.
 *   horizontal — landscape A4; days across the page, sessions as compact
 *                cards down each column (a month becomes a calendar grid).
 *
 * The fields the centre ticked decide the columns and card lines. Staff
 * appear by first name, with a surname initial only where two people on the
 * document share a first name.
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
const LINE = rgb(0.85, 0.88, 0.92);
const BAND = rgb(0.95, 0.97, 0.98);

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

interface Ctx { doc: PDFDocument; font: PDFFont; bold: PDFFont; page: PDFPage; y: number; w: number; h: number; landscape: boolean; title: string; centre: string; stamp: string; pageNo: number }

function newPage(c: Ctx): void {
  c.page = c.doc.addPage(c.landscape ? [A4.h, A4.w] : [A4.w, A4.h]);
  c.w = c.page.getWidth(); c.h = c.page.getHeight();
  c.pageNo++;
  // Header
  c.page.drawText(safe(c.centre), { x: M, y: c.h - M - 4, size: 15, font: c.bold, color: NAVY });
  c.page.drawText(safe(c.title), { x: M, y: c.h - M - 22, size: 10.5, font: c.font, color: SLATE });
  const right = safe(`Generated ${c.stamp} · page ${c.pageNo}`);
  c.page.drawText(right, { x: c.w - M - c.font.widthOfTextAtSize(right, 8), y: c.h - M - 4, size: 8, font: c.font, color: SLATE });
  c.page.drawLine({ start: { x: M, y: c.h - M - 30 }, end: { x: c.w - M, y: c.h - M - 30 }, thickness: 1, color: LINE });
  c.y = c.h - M - 44;
  // Footer
  const foot = safe("Produced by ActivityRoster · planning aid, not legal advice · check the live roster for late changes");
  c.page.drawText(foot, { x: M, y: M - 14, size: 7, font: c.font, color: SLATE });
}

function ensure(c: Ctx, needed: number): void { if (c.y - needed < M) newPage(c); }

/** Lines of text for one session, per the chosen fields. */
function sessionLines(s: RotaSession, t: RotaTemplateSettings, names: Map<string, string>, tz: string): { label: string; value: string }[] {
  const f = t.fields;
  const out: { label: string; value: string }[] = [];
  if (f.times) out.push({ label: "Time", value: `${clock(s.startAt, tz)}–${clock(s.endAt, tz)}` });
  out.push({ label: "Course", value: s.courseName });
  if (f.locations && s.locations.length) out.push({ label: "Where", value: s.locations.join(", ") });
  if (f.instructors) {
    const who = s.staff.filter((x) => x.status !== "declined").map((x) => (f.roles ? `${names.get(x.name) ?? x.name} (${x.role})` : names.get(x.name) ?? x.name));
    out.push({ label: "Staff", value: who.length ? who.join(", ") : "Unassigned" });
  }
  if (f.equipment && s.equipment.length) out.push({ label: "Kit", value: s.equipment.join(", ") });
  return out;
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
  const c: Ctx = { doc, font, bold, page: undefined as unknown as PDFPage, y: 0, w: 0, h: 0, landscape, title: input.title, centre: input.centreName, stamp, pageNo: 0 };
  newPage(c);

  const total = input.days.reduce((n, d) => n + d.sessions.length, 0);
  if (total === 0) {
    c.page.drawText(safe("Nothing rostered in this period yet."), { x: M, y: c.y - 10, size: 11, font, color: SLATE });
    return doc.save();
  }

  if (!landscape) drawVertical(c, input, names, tz);
  else if (input.template.range === "month") drawMonthGrid(c, input, names, tz);
  else drawColumns(c, input, names, tz);
  return doc.save();
}

// --- Vertical: one table per day -------------------------------------------

function drawVertical(c: Ctx, input: RotaPdfInput, names: Map<string, string>, tz: string): void {
  const f = input.template.fields;
  const cols: { key: string; label: string; w: number }[] = [];
  const inner = c.w - 2 * M;
  if (f.times) cols.push({ key: "Time", label: "Time", w: 70 });
  cols.push({ key: "Course", label: "Course", w: 0 });
  if (f.locations) cols.push({ key: "Where", label: "Where", w: 0 });
  if (f.instructors) cols.push({ key: "Staff", label: "Staff", w: 0 });
  if (f.equipment) cols.push({ key: "Kit", label: "Equipment", w: 0 });
  const fixed = cols.reduce((n, col) => n + col.w, 0);
  const flex = cols.filter((col) => col.w === 0);
  const flexW = (inner - fixed) / Math.max(1, flex.length);
  for (const col of flex) col.w = col.key === "Staff" ? flexW * 1.25 : col.key === "Course" ? flexW * 1.1 : flexW * (flex.length > 2 ? 0.825 : 1);
  const sum = cols.reduce((n, col) => n + col.w, 0);
  for (const col of cols) col.w = (col.w / sum) * inner;
  const size = 9, lh = 11.5, pad = 4;

  for (const day of input.days) {
    if (input.template.range !== "day" && day.sessions.length === 0 && input.template.range === "month") continue;
    ensure(c, 40);
    c.page.drawRectangle({ x: M, y: c.y - 16, width: inner, height: 18, color: BAND });
    c.page.drawText(safe(day.label), { x: M + 6, y: c.y - 11, size: 10.5, font: c.bold, color: NAVY });
    c.y -= 20;
    if (day.sessions.length === 0) {
      c.page.drawText("No sessions", { x: M + 6, y: c.y - 10, size: size, font: c.font, color: SLATE });
      c.y -= 18;
      continue;
    }
    // header row
    let x = M;
    for (const col of cols) { c.page.drawText(col.label, { x: x + pad, y: c.y - 10, size: 8, font: c.bold, color: SLATE }); x += col.w; }
    c.y -= 14;
    c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + inner, y: c.y }, thickness: 0.8, color: LINE });
    for (const s of day.sessions) {
      const lines = sessionLines(s, input.template, names, tz);
      const cells = cols.map((col) => wrap(lines.find((l) => l.label === col.key)?.value ?? "", c.font, size, col.w - 2 * pad));
      const rows = Math.max(1, ...cells.map((cl) => cl.length));
      const rowH = rows * lh + 2 * pad;
      if (c.y - rowH < M) {
        newPage(c);
        x = M;
        for (const col of cols) { c.page.drawText(col.label, { x: x + pad, y: c.y - 10, size: 8, font: c.bold, color: SLATE }); x += col.w; }
        c.y -= 14;
      }
      x = M;
      cells.forEach((cl, i) => {
        cl.forEach((line, j) => c.page.drawText(line, { x: x + pad, y: c.y - pad - lh * (j + 1) + 3, size, font: i === 1 ? c.bold : c.font, color: NAVY }));
        x += cols[i]!.w;
      });
      c.y -= rowH;
      c.page.drawLine({ start: { x: M, y: c.y }, end: { x: M + inner, y: c.y }, thickness: 0.5, color: LINE });
    }
    c.y -= 10;
  }
}

// --- Horizontal: days as columns, sessions as cards ---------------------------

function cardLines(s: RotaSession, input: RotaPdfInput, names: Map<string, string>, tz: string, font: PDFFont, width: number, size: number): string[] {
  const lines = sessionLines(s, input.template, names, tz);
  const out: string[] = [];
  for (const l of lines) {
    const text = l.label === "Course" || l.label === "Time" ? l.value : `${l.label}: ${l.value}`;
    out.push(...wrap(text, font, size, width));
  }
  return out;
}

function drawColumns(c: Ctx, input: RotaPdfInput, names: Map<string, string>, tz: string): void {
  const days = input.days;
  const inner = c.w - 2 * M;
  const gap = 6;
  const colW = (inner - gap * (days.length - 1)) / days.length;
  const size = days.length > 5 ? 7.5 : 9, lh = size + 2.5, pad = 4;
  const headerH = 18;
  const drawHeaders = () => {
    days.forEach((d, i) => {
      const x = M + i * (colW + gap);
      c.page.drawRectangle({ x, y: c.y - headerH, width: colW, height: headerH, color: BAND });
      c.page.drawText(wrap(d.label, c.bold, 8.5, colW - 2 * pad)[0] ?? "", { x: x + pad, y: c.y - 12.5, size: 8.5, font: c.bold, color: NAVY });
    });
    c.y -= headerH + 4;
  };
  drawHeaders();
  const maxRows = Math.max(...days.map((d) => d.sessions.length));
  if (maxRows === 0) return;
  for (let r = 0; r < maxRows; r++) {
    const cards = days.map((d) => d.sessions[r] ? cardLines(d.sessions[r]!, input, names, tz, c.font, colW - 2 * pad, size) : null);
    const rowH = Math.max(...cards.map((cl) => (cl ? cl.length * lh + 2 * pad : 0))) + gap;
    if (c.y - rowH < M) { newPage(c); drawHeaders(); }
    cards.forEach((cl, i) => {
      if (!cl) return;
      const x = M + i * (colW + gap);
      const h = cl.length * lh + 2 * pad;
      c.page.drawRectangle({ x, y: c.y - h, width: colW, height: h, borderColor: LINE, borderWidth: 0.7, color: rgb(1, 1, 1) });
      c.page.drawRectangle({ x, y: c.y - h, width: 2.5, height: h, color: TEAL });
      cl.forEach((line, j) => c.page.drawText(line, { x: x + pad + 2, y: c.y - pad - lh * (j + 1) + 3, size, font: j === (input.template.fields.times ? 1 : 0) ? c.bold : c.font, color: NAVY }));
    });
    c.y -= rowH;
  }
}

function drawMonthGrid(c: Ctx, input: RotaPdfInput, names: Map<string, string>, tz: string): void {
  // Calendar: Monday–Sunday columns, one row per week; each cell lists its sessions compactly.
  const inner = c.w - 2 * M;
  const colW = inner / 7;
  const size = 6.8, lh = 8.6, pad = 3;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const drawHead = () => {
    dayNames.forEach((n, i) => c.page.drawText(n, { x: M + i * colW + pad, y: c.y - 10, size: 8, font: c.bold, color: SLATE }));
    c.y -= 14;
  };
  drawHead();
  const first = new Date(`${input.days[0]!.date}T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (RotaDay | null)[] = [...Array(lead).fill(null), ...input.days];
  while (cells.length % 7) cells.push(null);
  for (let w = 0; w < cells.length / 7; w++) {
    const week = cells.slice(w * 7, w * 7 + 7);
    const content = week.map((d) => {
      if (!d) return [] as { text: string; bold: boolean }[];
      const lines: { text: string; bold: boolean }[] = [];
      for (const s of d.sessions) {
        const l = sessionLines(s, input.template, names, tz);
        const time = l.find((x) => x.label === "Time")?.value;
        for (const t of wrap(`${time ? `${time} ` : ""}${s.courseName}`, c.bold, size, colW - 2 * pad)) lines.push({ text: t, bold: true });
        const rest = l.filter((x) => x.label !== "Time" && x.label !== "Course").map((x) => x.value).join(" · ");
        if (rest) for (const t of wrap(rest, c.font, size, colW - 2 * pad)) lines.push({ text: t, bold: false });
      }
      return lines;
    });
    const rowH = Math.max(28, ...content.map((cl) => cl.length * lh + 14 + 2 * pad));
    if (c.y - rowH < M) { newPage(c); drawHead(); }
    week.forEach((d, i) => {
      const x = M + i * colW;
      c.page.drawRectangle({ x, y: c.y - rowH, width: colW, height: rowH, borderColor: LINE, borderWidth: 0.6, color: d ? rgb(1, 1, 1) : BAND });
      if (!d) return;
      c.page.drawText(String(Number(d.date.slice(8, 10))), { x: x + pad, y: c.y - 10, size: 8, font: c.bold, color: TEAL });
      content[i]!.forEach((line, j) => {
        c.page.drawText(line.text, { x: x + pad, y: c.y - 14 - pad - lh * (j + 1) + 3, size, font: line.bold ? c.bold : c.font, color: NAVY });
      });
    });
    c.y -= rowH;
  }
}
