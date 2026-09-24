"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, StatusPill } from "@/components/ui";

type Slot = "AM" | "PM" | "EV";
type Avail = "free" | "maybe" | "busy" | "none";
type Panel =
  | "dash" | "courses" | "availability" | "timeclock" | "leave"
  | "staff" | "equipment" | "bookings" | "reports" | "finance" | "settings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const NAV: { label: string; key: Panel; group?: string }[] = [
  { label: "Dashboard", key: "dash" },
  { label: "Courses", key: "courses" },
  { label: "Availability", key: "availability" },
  { label: "Time clock", key: "timeclock" },
  { label: "Leave & cover", key: "leave" },
  { label: "Staff (HR)", key: "staff" },
  { label: "Equipment", key: "equipment" },
  { label: "Bookings", key: "bookings" },
  { label: "Reports", key: "reports" },
  { label: "Payroll", key: "finance" },
  { label: "Settings", key: "settings" },
];

// ---------------------------------------------------------------------------
// Shared example staff roster (used by both the Staff and Availability tabs).
// `badges` are RYA instructor qualifications; `lic` is whether every mandatory
// licence / ticket is currently valid.
// ---------------------------------------------------------------------------
type Lic = "up" | "expiring" | "blocked";
type Emp = "Employed" | "Freelance" | "Volunteer";

const BADGE_MEANING: Record<string, string> = {
  SI: "Senior Instructor",
  DI: "Dinghy Instructor",
  AI: "Assistant Instructor",
  PBI: "Powerboat Instructor",
  WI: "Windsurfing Instructor",
  SBC: "Safety Boat",
};

// availability pattern per day (Mon→Sun): f=free a=AM only p=PM only b=busy o=off
const STAFF: {
  n: string;
  e: Emp;
  badges: string[];
  lic: Lic;
  note: string;
  pat: string;
}[] = [
  { n: "Sarah Whitlock", e: "Employed", badges: ["SI", "DI", "PBI", "SBC"], lic: "up", note: "—", pat: "ofafffp" },
  { n: "Tom Bergin", e: "Freelance", badges: ["DI", "WI"], lic: "expiring", note: "Safeguarding expires 12 Oct", pat: "fofaoff" },
  { n: "Aoife Kelly", e: "Employed", badges: ["DI", "PBI"], lic: "blocked", note: "First Aid expired 30 Aug", pat: "affofpf" },
  { n: "Dan Rees", e: "Volunteer", badges: ["PBI", "SBC"], lic: "up", note: "—", pat: "ooffffb" },
  { n: "Megan Foyle", e: "Employed", badges: ["SI", "DI"], lic: "up", note: "—", pat: "faffoff" },
  { n: "Liam O'Connor", e: "Freelance", badges: ["DI", "AI"], lic: "up", note: "—", pat: "ofofffp" },
  { n: "Priya Nair", e: "Employed", badges: ["DI", "WI", "SBC"], lic: "up", note: "—", pat: "ffaofff" },
  { n: "Jack Turnbull", e: "Freelance", badges: ["PBI", "SBC"], lic: "expiring", note: "Powerboat cert expires 30 Nov", pat: "bofofff" },
  { n: "Ella Munro", e: "Volunteer", badges: ["AI"], lic: "up", note: "—", pat: "offfaff" },
  { n: "Ryan Doyle", e: "Freelance", badges: ["DI", "PBI"], lic: "up", note: "—", pat: "fofoffb" },
  { n: "Chloe Adeyemi", e: "Employed", badges: ["SI", "DI", "WI"], lic: "up", note: "—", pat: "ffoffaf" },
  { n: "Fionn Walsh", e: "Freelance", badges: ["DI"], lic: "expiring", note: "DBS renewal due 05 Nov", pat: "afffoff" },
  { n: "Grace Hollis", e: "Volunteer", badges: ["AI", "SBC"], lic: "up", note: "—", pat: "oofffff" },
  { n: "Noah Pereira", e: "Employed", badges: ["DI", "PBI", "SBC"], lic: "up", note: "—", pat: "fffaofp" },
  { n: "Isla Fraser", e: "Freelance", badges: ["WI", "DI"], lic: "up", note: "—", pat: "ofaffff" },
  { n: "Ben Okafor", e: "Freelance", badges: ["PBI", "SBC"], lic: "blocked", note: "Safety Boat cert lapsed 15 Sep", pat: "fooffbf" },
  { n: "Maya Sørensen", e: "Employed", badges: ["SI", "DI", "PBI"], lic: "up", note: "—", pat: "fafffof" },
  { n: "Cormac Byrne", e: "Volunteer", badges: ["AI"], lic: "up", note: "—", pat: "offoffa" },
  { n: "Hannah Leung", e: "Freelance", badges: ["DI", "WI"], lic: "up", note: "—", pat: "ffafoff" },
  { n: "Oscar Mendez", e: "Freelance", badges: ["PBI", "SBC"], lic: "up", note: "—", pat: "oofffbf" },
  { n: "Freya Donnelly", e: "Employed", badges: ["DI", "AI"], lic: "expiring", note: "First Aid expires 20 Oct", pat: "affffof" },
  { n: "Amir Hassan", e: "Freelance", badges: ["DI", "PBI", "WI", "SBC"], lic: "up", note: "—", pat: "fffaffb" },
];

const WEEK: Record<string, Record<Slot, { name: string; time: string; state: "ok" | "att" | "bad" } | null>> = {
  Mon: { AM: { name: "Start Sailing", time: "09:00", state: "ok" }, PM: null, EV: null },
  Tue: { AM: null, PM: { name: "Improving Skills", time: "13:00", state: "ok" }, EV: null },
  Wed: { AM: { name: "Youth Stage 2", time: "09:00", state: "att" }, PM: null, EV: { name: "Adult Improver", time: "17:30", state: "ok" } },
  Thu: { AM: null, PM: { name: "Youth Stage 2", time: "13:00", state: "ok" }, EV: null },
  Fri: { AM: { name: "Start Sailing", time: "09:00", state: "ok" }, PM: null, EV: null },
  Sat: { AM: { name: "Powerboat L2", time: "09:00", state: "bad" }, PM: { name: "Start Windsurf", time: "13:00", state: "ok" }, EV: null },
  Sun: { AM: null, PM: null, EV: null },
};

const chipTone = { ok: "bg-starboard/10 text-starboard", att: "bg-amber/10 text-amber", bad: "bg-port/10 text-port" };

const DEMO_ALERTS = [
  { title: "Leave approved", body: "Liam O'Connor — 6–10 Oct", tone: "starboard" },
  { title: "Shift claimed", body: "Grace Hollis offered Sat safety-boat cover", tone: "teal" },
  { title: "Ticket expiring", body: "Tom Bergin — Safeguarding expires 12 Oct", tone: "amber" },
];

export function DemoApp() {
  const [view, setView] = useState<"office" | "portal">("office");
  const [panel, setPanel] = useState<Panel>("dash");
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <div>
      {/* Read-only mock-up banner */}
      <div className="mb-4 flex items-start gap-2 rounded-card border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-[#8a6314]">
        <span aria-hidden>👀</span>
        <p>
          <span className="font-semibold">This is a read-only mock-up</span> with example data to show how
          ActivityRoster looks and behaves. Clicking around won&apos;t change or save anything — your real centre
          will be fully editable.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {(["office", "portal"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${view === v ? "bg-navy text-white" : "text-slate-500"}`}
            >
              {v === "office" ? "Office admin" : "Instructor portal"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowAlerts((s) => !s)}
              className="relative rounded-full border border-slate-200 bg-white p-2 text-navy hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-port px-1 text-[10px] font-bold text-white">{DEMO_ALERTS.length}</span>
            </button>
            {showAlerts ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-card border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
                {DEMO_ALERTS.map((a) => (
                  <div key={a.title} className="flex gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <span className={`mt-1 h-2 w-2 flex-none rounded-full bg-${a.tone}`} />
                    <div><p className="text-sm font-semibold text-navy">{a.title}</p><p className="text-xs text-slate-500">{a.body}</p></div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/#get-demo" className="text-sm font-semibold text-teal hover:underline">
            Try this free for a month →
          </Link>
        </div>
      </div>

      {view === "office" ? (
        <div className="overflow-hidden rounded-card border border-slate-200 shadow-sm">
          <div className="grid md:grid-cols-[200px_1fr]">
            <aside className="hidden bg-navy p-4 text-white md:block">
              <p className="font-display text-lg font-bold">
                Activity<span className="text-ryablue-bright">Roster</span>
              </p>
              <p className="mb-3 border-b border-white/10 pb-3 text-xs text-white/60">Harbour Sailing Centre</p>
              {NAV.map((item) => {
                const active = panel === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setPanel(item.key)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10"}`}
                  >
                    <span className={`h-3.5 w-3.5 rounded ${active ? "bg-teal" : "bg-white/25"}`} />
                    {item.label}
                  </button>
                );
              })}
            </aside>

            <div className="bg-canvas p-5">
              {/* Mobile tab switcher — all sections */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
                {NAV.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setPanel(item.key)}
                    className={`flex-none rounded-lg border px-3 py-1.5 text-sm font-semibold ${panel === item.key ? "border-teal bg-teal text-white" : "border-slate-200 bg-white text-slate-500"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {panel === "dash" ? <DemoDashboard /> : null}
              {panel === "courses" ? <DemoCourses /> : null}
              {panel === "availability" ? <DemoAvailability /> : null}
              {panel === "timeclock" ? <DemoTimeClock /> : null}
              {panel === "leave" ? <DemoLeave /> : null}
              {panel === "staff" ? <DemoStaff /> : null}
              {panel === "equipment" ? <DemoEquipment /> : null}
              {panel === "bookings" ? <DemoBookings /> : null}
              {panel === "reports" ? <DemoReports /> : null}
              {panel === "finance" ? <DemoFinance /> : null}
              {panel === "settings" ? <DemoSettings /> : null}
            </div>
          </div>
        </div>
      ) : (
        <DemoPortal />
      )}

      <p className="mt-4 text-center text-xs text-slate-400">Interactive demo with example data — nothing here is saved.</p>
    </div>
  );
}

function DemoDashboard() {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Dashboard</h2>
      <p className="text-sm text-slate-500">Harbour Sailing Centre · week of 21 Sep</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        This week at a glance — the three things to act on before the water
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-navy">Staff blocked from rostering</p>
          <p className="mt-1 text-3xl font-semibold text-port">2</p>
          <p className="text-xs text-slate-500">A mandatory licence has lapsed — they can&apos;t be assigned until it&apos;s renewed.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-navy">Licences expiring soon</p>
          <p className="mt-1 text-3xl font-semibold text-amber">4</p>
          <p className="text-xs text-slate-500">Tickets or vetting due within the next 6 weeks — renew before they stop a roster.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-navy">Courses needing attention</p>
          <p className="mt-1 text-3xl font-semibold text-amber">2</p>
          <p className="text-xs text-slate-500">Under-staffed or missing safety-boat cover for the group size.</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-x-auto">
        <h3 className="mb-3 font-semibold text-navy">This week&apos;s sessions</h3>
        <table className="w-full min-w-[620px] border-collapse text-xs">
          <thead>
            <tr><th className="w-10"></th>{DAYS.map((d) => <th key={d} className="px-2 py-1 text-left font-semibold text-slate-500">{d}</th>)}</tr>
          </thead>
          <tbody>
            {(["AM", "PM", "EV"] as Slot[]).map((slot) => (
              <tr key={slot} className="align-top">
                <td className="py-1 pr-2 font-bold text-slate-400">{slot}</td>
                {DAYS.map((d) => {
                  const cell = WEEK[d]![slot];
                  return (
                    <td key={d + slot} className="min-w-[80px] border border-slate-100 p-1">
                      {cell ? (
                        <div className={`rounded-md px-2 py-1 ${chipTone[cell.state]}`}>
                          <div className="font-semibold leading-tight">{cell.name}</div>
                          <div className="text-[10px] opacity-80">{cell.time}</div>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4">
        <h3 className="mb-1 font-semibold text-navy">Coverage check</h3>
        {[
          { c: "Youth Stage 2 · Wed AM", m: "RYA Youth Sailing", tone: "attention" as const, t: "Under-staffed", s: "1 / 2 staff" },
          { c: "Powerboat Level 2 · Sat AM", m: "RYA Powerboat", tone: "conflict" as const, t: "No safety cover", s: "safety boat required" },
          { c: "Start Sailing · Mon AM", m: "RYA National Sailing", tone: "covered" as const, t: "Covered", s: "2 / 2 staff" },
        ].map((r) => (
          <div key={r.c} className="flex items-center justify-between border-t border-slate-100 py-2.5 first:border-t-0">
            <div><p className="text-sm font-semibold text-navy">{r.c}</p><p className="text-xs text-slate-400">{r.m}</p></div>
            <div className="text-right"><StatusPill tone={r.tone}>{r.t}</StatusPill><p className="text-xs text-slate-400">{r.s}</p></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

type Course = {
  name: string; meta: string; tone: "covered" | "conflict" | "attention"; pill: string;
  staff: string[]; warn: string | null; assign?: boolean;
  detail: { students: string; times: string[]; kit: string[]; note: string };
};

const COURSES: Course[] = [
  {
    name: "Powerboat Level 2", meta: "RYA Powerboat · Sat 26 Sep · 1/1 staff", tone: "conflict", pill: "No safety cover",
    staff: ["Dan Rees · Instructor"], warn: "Safety boat required for this course — no safety-boat driver assigned yet.", assign: true,
    detail: { students: "6 booked (max 6)", times: ["Sat 26 Sep · 09:00–12:30 — theory & handling", "Sat 26 Sep · 13:30–16:30 — on-water assessment"], kit: ["RIB “Kestrel”", "Fuel & kill-cords checked"], note: "Ratio 1:3. Certificates issued on completion." },
  },
  {
    name: "Youth Stage 2", meta: "RYA Youth Sailing · Wed 24 Sep · 1/2 staff", tone: "attention", pill: "Under-staffed",
    staff: ["Megan Foyle · Senior Instructor"], warn: "Group of 12 needs 2 ratio-counting instructors — 1 more to assign.",
    detail: { students: "12 booked (max 12)", times: ["Wed 24 Sep · 09:00–12:00 — rigging & launching", "Wed 24 Sep · 13:00–15:30 — sailing skills"], kit: ["Pico dinghies ×6", "Safety boat on standby"], note: "RYA ratio for under-16s is 1:6 — a second instructor is required." },
  },
  {
    name: "Start Sailing", meta: "RYA National Sailing · Mon 21 Sep · 2/2 staff", tone: "covered", pill: "Covered",
    staff: ["Sarah Whitlock · Senior Instructor", "Dan Rees · Safety Boat"], warn: null,
    detail: { students: "8 booked (max 8)", times: ["Mon 21 Sep · 09:00–12:30 — intro & first sail", "Mon 21 Sep · 13:30–16:00 — points of sail"], kit: ["Wayfarer ×4", "RIB “Merlin”"], note: "Two-day course — continues Tue 22 Sep." },
  },
  {
    name: "Improving Skills", meta: "RYA National Sailing · Tue 22 Sep · 2/2 staff", tone: "covered", pill: "Covered",
    staff: ["Chloe Adeyemi · Senior Instructor", "Liam O'Connor · Instructor"], warn: null,
    detail: { students: "7 booked (max 8)", times: ["Tue 22 Sep · 13:00–16:30 — sail trim & tacking"], kit: ["ILCA / Laser ×6"], note: "Feeds into Seamanship Skills next month." },
  },
  {
    name: "Adult Improver", meta: "RYA National Sailing · Wed 24 Sep (EV) · 1/1 staff", tone: "covered", pill: "Covered",
    staff: ["Priya Nair · Instructor"], warn: null,
    detail: { students: "5 booked (max 6)", times: ["Wed 24 Sep · 17:30–20:00 — evening session"], kit: ["Wayfarer ×3"], note: "Evening twilight sail — buoyancy aids mandatory." },
  },
  {
    name: "Start Windsurfing", meta: "RYA Windsurfing · Sat 26 Sep · 2/2 staff", tone: "covered", pill: "Covered",
    staff: ["Isla Fraser · Windsurf Instructor", "Hannah Leung · Windsurf Instructor"], warn: null,
    detail: { students: "10 booked (max 10)", times: ["Sat 26 Sep · 13:00–16:30 — beginner windsurf"], kit: ["Windsurf boards ×10"], note: "Warm-water gear provided; wetsuits sized on arrival." },
  },
  {
    name: "Stage 1 Junior", meta: "RYA Youth Sailing · Sun 27 Sep · 2/2 staff", tone: "covered", pill: "Covered",
    staff: ["Maya Sørensen · Senior Instructor", "Ella Munro · Assistant"], warn: null,
    detail: { students: "9 booked (max 12)", times: ["Sun 27 Sep · 10:00–12:30 — games & first sail"], kit: ["Topper ×8"], note: "Parents welcome to watch from the balcony." },
  },
];

function DemoCourses() {
  const [open, setOpen] = useState<string | null>("Powerboat Level 2");
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Courses</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ New course</span>
      </div>
      <p className="text-sm text-slate-500">This week&apos;s catalogue — click a course to open it.</p>
      <div className="mt-4 space-y-3">
        {COURSES.map((c) => {
          const isOpen = open === c.name;
          return (
            <Card key={c.name}>
              <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(isOpen ? null : c.name)}>
                <div>
                  <p className="font-semibold text-navy">{c.name} <span className="ml-1 text-xs font-normal text-slate-400">{isOpen ? "▾" : "▸"}</span></p>
                  <p className="text-xs text-slate-400">{c.meta}</p>
                </div>
                <StatusPill tone={c.tone}>{c.pill}</StatusPill>
              </button>

              {c.staff.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.staff.map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{s}</span>
                  ))}
                </div>
              ) : null}
              {c.warn ? (
                <p className={`mt-2 flex items-center gap-1.5 text-sm ${c.tone === "conflict" ? "text-port" : "text-amber"}`}>● {c.warn}</p>
              ) : null}

              {isOpen ? (
                <div className="mt-3 grid gap-4 rounded-lg bg-canvas p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Students</p>
                    <p className="mt-1 text-sm text-navy">{c.detail.students}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sessions</p>
                    <ul className="mt-1 space-y-1 text-sm text-slate-600">
                      {c.detail.times.map((t) => <li key={t}>• {t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Boats &amp; kit</p>
                    <ul className="mt-1 space-y-1 text-sm text-slate-600">
                      {c.detail.kit.map((k) => <li key={k}>• {k}</li>)}
                    </ul>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Note</p>
                    <p className="mt-1 text-sm text-slate-600">{c.detail.note}</p>
                  </div>
                  {c.assign ? (
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                      <span className="text-sm text-slate-500">Add safety cover:</span>
                      <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Aoife Kelly ⚠ expired ▾</span>
                      <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Safety Boat Driver ▾</span>
                      <button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white">Assign</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const SHIFTS = ["AM", "PM", "EV"] as const;

// Course roles that need an instructor, keyed by "<dayIdx>|<shiftIdx>" (day 0 = Mon).
const SHIFT_DEMAND: Record<string, string[]> = {
  "0|0": ["Start Sailing", "Youth Stage 1", "Safety Boat cover"],
  "0|1": ["Improving Skills"],
  "1|1": ["Improving Skills", "Safety Boat cover"],
  "2|0": ["Youth Stage 2", "Youth Stage 2 (2nd)"],
  "2|2": ["Adult Improver"],
  "3|1": ["Youth Stage 2"],
  "4|0": ["Start Sailing", "Safety Boat cover"],
  "5|0": ["Powerboat L2", "Powerboat L2 Safety Boat"],
  "5|1": ["Start Windsurf", "Start Windsurf (2nd)"],
  "6|1": ["Junior Stage 1", "Junior Stage 1 Assistant"],
};

// Pre-filled assignments to seed the demo: "<staffIdx>|<dayIdx>|<shiftIdx>": role
const SEED_ASSIGN: Record<string, string> = {
  "0|0|0": "Start Sailing",
  "3|0|0": "Safety Boat cover",
  "10|0|1": "Improving Skills",
  "4|2|0": "Youth Stage 2",
  "6|2|2": "Adult Improver",
  "14|5|1": "Start Windsurf",
};

// Base availability for a (staff, day, shift): free | maybe | off
function baseAvail(si: number, di: number, shi: number): "free" | "maybe" | "off" {
  const h = (si * 7 + di * 5 + shi * 11 + si * shi) % 10;
  if (h < 6) return "free";
  if (h < 8) return "maybe";
  return "off";
}

const abbr = (r: string) =>
  r.split(/[\s()]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

function DemoAvailability() {
  const [assign, setAssign] = useState<Record<string, string>>(SEED_ASSIGN);
  const [sel, setSel] = useState<string | null>(null); // "si|di|shi"
  const [pick, setPick] = useState<string>("");

  const rolesTaken = (di: number, shi: number) =>
    Object.keys(assign)
      .filter((k) => { const p = k.split("|"); return +p[1]! === di && +p[2]! === shi; })
      .map((k) => assign[k]!);
  const demandOf = (di: number, shi: number) => SHIFT_DEMAND[`${di}|${shi}`] ?? [];
  const openOf = (di: number, shi: number) => demandOf(di, shi).filter((r) => !rolesTaken(di, shi).includes(r));

  let totalOpen = 0;
  let totalShifts = 0;
  for (let di = 0; di < 7; di++) for (let shi = 0; shi < 3; shi++) { totalOpen += openOf(di, shi).length; totalShifts += demandOf(di, shi).length; }

  const selectCell = (si: number, di: number, shi: number) => {
    setSel(`${si}|${di}|${shi}`);
    setPick(openOf(di, shi)[0] ?? "");
  };
  const doAssign = () => { if (sel && pick) { setAssign((a) => ({ ...a, [sel]: pick })); setSel(null); } };
  const doUnassign = () => { if (sel) { setAssign((a) => { const n = { ...a }; delete n[sel]; return n; }); setSel(null); } };

  const p = sel?.split("|");
  const sSi = p ? +p[0]! : -1, sDi = p ? +p[1]! : -1, sShi = p ? +p[2]! : -1;
  const sAssigned = sel ? assign[sel] : undefined;
  const sBase = sel ? baseAvail(sSi, sDi, sShi) : "off";
  const sOpen = sel ? openOf(sDi, sShi) : [];

  const cellCls = { free: "bg-starboard/15 text-starboard hover:bg-starboard/25", maybe: "bg-amber/15 text-amber hover:bg-amber/25", off: "bg-slate-100 text-slate-300" };

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Availability</h2>
      <p className="text-sm text-slate-500">
        {STAFF.length} instructors · AM / PM / EV every day. <span className="font-semibold text-port">{totalOpen}</span> of {totalShifts} shifts still to fill this week.
      </p>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center rounded-full bg-starboard/15 px-2.5 py-0.5 font-medium text-starboard">Free</span>
        <span className="inline-flex items-center rounded-full bg-teal px-2.5 py-0.5 font-medium text-white">Assigned</span>
        <span className="inline-flex items-center rounded-full bg-amber/15 px-2.5 py-0.5 font-medium text-amber">Maybe</span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-400">Off</span>
        <span className="text-slate-400">· tap any box to assign or view</span>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="border-collapse text-center text-[10px]">
          <thead>
            {/* Day row */}
            <tr className="bg-slate-50 text-slate-500">
              <th rowSpan={3} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold">Instructor</th>
              {DAYS.map((d) => (
                <th key={d} colSpan={3} className="border-l border-slate-200 px-1 py-1 font-semibold">{d}</th>
              ))}
            </tr>
            {/* Shift row */}
            <tr className="bg-slate-50 text-slate-400">
              {DAYS.map((_, di) => SHIFTS.map((sh, shi) => (
                <th key={`${di}-${sh}`} className={`w-9 px-0.5 py-0.5 font-semibold ${shi === 0 ? "border-l border-slate-200" : ""}`}>{sh}</th>
              )))}
            </tr>
            {/* Count row: open / total shifts to fill */}
            <tr className="bg-slate-50">
              {DAYS.map((_, di) => SHIFTS.map((sh, shi) => {
                const open = openOf(di, shi).length, tot = demandOf(di, shi).length;
                const tone = tot === 0 ? "text-slate-300" : open > 0 ? "text-port" : "text-starboard";
                return (
                  <th key={`c${di}-${sh}`} className={`px-0.5 pb-1 font-bold ${tone} ${shi === 0 ? "border-l border-slate-200" : ""}`} title="Shifts to fill / total shifts">
                    {tot === 0 ? "·" : `${open}/${tot}`}
                  </th>
                );
              }))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAFF.map((s, si) => (
              <tr key={s.n} className="hover:bg-slate-50/40">
                <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-1 text-left text-xs font-medium text-navy">
                  <span className="whitespace-nowrap">{s.n}</span>
                  {s.lic === "blocked" ? <span className="ml-1 align-middle text-port" title="Licence expired — blocked from rostering">●</span> : null}
                </td>
                {DAYS.map((_, di) => SHIFTS.map((_sh, shi) => {
                  const key = `${si}|${di}|${shi}`;
                  const role = assign[key];
                  const base = baseAvail(si, di, shi);
                  const isSel = sel === key;
                  const cls = role ? "bg-teal text-white hover:bg-teal-700" : cellCls[base];
                  return (
                    <td key={key} className={`p-0 ${shi === 0 ? "border-l border-slate-200" : ""}`}>
                      <button
                        onClick={() => selectCell(si, di, shi)}
                        title={role ? `Assigned: ${role}` : base === "off" ? "Unavailable" : "Available"}
                        className={`h-6 w-9 font-semibold ${cls} ${isSel ? "ring-2 ring-inset ring-navy" : ""}`}
                      >
                        {role ? abbr(role) : base === "free" ? "✓" : base === "maybe" ? "~" : ""}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Assign / detail panel */}
      {sel ? (
        <Card className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-navy">{STAFF[sSi]!.n}</p>
              <p className="text-xs text-slate-500">{DAYS[sDi]} · {SHIFTS[sShi]} shift</p>
            </div>
            <button onClick={() => setSel(null)} className="text-xs text-slate-400 hover:text-slate-600">Close ✕</button>
          </div>

          {sAssigned ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-teal/10 px-3 py-1.5 text-sm font-semibold text-teal">Assigned to {sAssigned}</span>
              <button onClick={doUnassign} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Unassign</button>
            </div>
          ) : sBase === "off" ? (
            <p className="mt-3 text-sm text-slate-500">Marked unavailable for this shift — nothing to assign.</p>
          ) : sOpen.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sBase === "maybe" ? <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber">Marked “maybe” — confirm first</span> : null}
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal">
                {sOpen.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={doAssign} className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">Assign</button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">This instructor is free, but every shift in this slot is already covered.</p>
          )}
        </Card>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Tap a box: assigned shifts show the course; free shifts open a dropdown to roster the instructor.</p>
      )}
    </div>
  );
}

const LIC_PILL: Record<Lic, { tone: "covered" | "conflict" | "attention"; label: string }> = {
  up: { tone: "covered", label: "Up to date" },
  expiring: { tone: "attention", label: "Expiring soon" },
  blocked: { tone: "conflict", label: "Expired" },
};

type StaffRow = (typeof STAFF)[number];

const ONBOARDING = ["Contract signed", "Induction & site tour", "Safeguarding training", "First Aid confirmed", "Kit issued", "Added to payroll"];
const ONBOARDING_IN_PROGRESS = new Set(["Cormac Byrne", "Ella Munro"]);

function docsFor(s: StaffRow) {
  const docs: { name: string; exp: string; st: Lic }[] = [
    { name: "First Aid", exp: "14 May 2027", st: "up" },
    { name: "Safeguarding", exp: "02 Feb 2027", st: "up" },
    { name: "DBS / vetting", exp: "20 Jun 2027", st: "up" },
    ...s.badges.map((b) => ({ name: `RYA ${BADGE_MEANING[b]}`, exp: "current", st: "up" as Lic })),
  ];
  if (s.lic !== "up") {
    const note = s.note.toLowerCase();
    const match = (kw: string) => note.includes(kw);
    const target =
      match("first aid") ? "First Aid" :
      match("safeguard") ? "Safeguarding" :
      match("dbs") ? "DBS / vetting" :
      match("safety boat") ? "RYA Safety Boat" :
      match("powerboat") ? "RYA Powerboat Instructor" : "First Aid";
    const d = docs.find((x) => x.name === target);
    if (d) { d.st = s.lic; d.exp = s.note.replace(/^[^0-9]*/, "") || d.exp; }
  }
  return docs;
}

function DemoStaff() {
  const [open, setOpen] = useState<string | null>(null);
  const openRow = STAFF.find((s) => s.n === open) ?? null;
  const docs = openRow ? docsFor(openRow) : [];
  const inProgress = openRow ? ONBOARDING_IN_PROGRESS.has(openRow.n) : false;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Staff (HR)</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ Add staff</span>
      </div>
      <p className="text-sm text-slate-500">{STAFF.length} instructors · click anyone to open their HR profile, documents &amp; onboarding.</p>

      {/* Badge legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {Object.entries(BADGE_MEANING).map(([code, meaning]) => (
          <span key={code}><span className="font-semibold text-navy">{code}</span> {meaning}</span>
        ))}
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Instructor type</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3">Licences up to date</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAFF.map((s) => (
              <tr key={s.n} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(s.n)}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-teal underline decoration-teal/30 underline-offset-2">{s.n}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {s.badges.map((b) => (
                      <span key={b} className="rounded bg-navy/5 px-1.5 py-0.5 text-xs font-semibold text-navy" title={BADGE_MEANING[b]}>{b}</span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.e}</td>
                <td className="px-4 py-3"><StatusPill tone={LIC_PILL[s.lic].tone}>{LIC_PILL[s.lic].label}</StatusPill></td>
                <td className={`px-4 py-3 ${s.lic === "blocked" ? "text-port" : s.lic === "expiring" ? "text-amber" : "text-slate-500"}`}>{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* HR profile drawer */}
      {openRow ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={() => setOpen(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-navy">{openRow.n}</h3>
                <p className="text-xs text-slate-500">{openRow.e} · {openRow.badges.join(" · ")}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-sm text-slate-400 hover:text-slate-600">Close ✕</button>
            </div>

            <div className="mt-3"><StatusPill tone={LIC_PILL[openRow.lic].tone}>Licences {LIC_PILL[openRow.lic].label.toLowerCase()}</StatusPill></div>

            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Documents &amp; certificates</h4>
            <table className="mt-2 w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {docs.map((d) => (
                  <tr key={d.name}>
                    <td className="py-2 text-navy">{d.name}</td>
                    <td className="py-2 text-xs text-slate-500">{d.exp}</td>
                    <td className="py-2 text-right"><StatusPill tone={LIC_PILL[d.st].tone}>{LIC_PILL[d.st].label}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">+ Upload document</button>

            <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Onboarding</h4>
            <ul className="mt-2 space-y-1.5">
              {ONBOARDING.map((task, i) => {
                const done = !inProgress || i < ONBOARDING.length - 2;
                return (
                  <li key={task} className="flex items-center gap-2 text-sm">
                    <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] text-white ${done ? "bg-starboard" : "bg-slate-300"}`}>{done ? "✓" : ""}</span>
                    <span className={done ? "text-slate-600" : "text-slate-400"}>{task}</span>
                  </li>
                );
              })}
            </ul>
            {inProgress ? <p className="mt-2 text-xs text-amber">Onboarding in progress — 2 steps to go.</p> : <p className="mt-2 text-xs text-starboard">Fully onboarded.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const KIT = [
  { item: "RIB safety boat — “Kestrel”", type: "Safety boat", last: "18 Sep 2026", next: "18 Dec 2026", tone: "covered" as const, st: "Serviceable", log: ["Engine service & impeller replaced (18 Sep)", "Kill-cords and fuel checked", "Assigned to: Powerboat L2, Sat"] },
  { item: "RIB safety boat — “Merlin”", type: "Safety boat", last: "02 Aug 2026", next: "28 Sep 2026", tone: "attention" as const, st: "Service due", log: ["Annual service due 28 Sep — booked with marina", "Nav lights replaced (Aug)", "Assigned to: Start Sailing, Mon"] },
  { item: "RIB safety boat — “Falcon”", type: "Safety boat", last: "22 Sep 2026", next: "22 Dec 2026", tone: "covered" as const, st: "Serviceable", log: ["Handed back after full service (22 Sep)", "New VHF radio fitted", "Assigned to: Powerboat L2, Sat"] },
  { item: "Pico dinghies ×12", type: "Dinghy", last: "10 Sep 2026", next: "10 Mar 2027", tone: "covered" as const, st: "Serviceable", log: ["Hulls & rigging inspected (10 Sep)", "2 new mainsails this season"] },
  { item: "ILCA / Laser ×6", type: "Dinghy", last: "10 Sep 2026", next: "10 Mar 2027", tone: "covered" as const, st: "Serviceable", log: ["Foils checked, no damage", "Assigned to: Improving Skills, Tue"] },
  { item: "Wayfarer ×4", type: "Dinghy", last: "05 Sep 2026", next: "05 Mar 2027", tone: "covered" as const, st: "Serviceable", log: ["Buoyancy tanks pressure-tested", "Assigned to: Start Sailing, Mon"] },
  { item: "Topper ×8", type: "Dinghy", last: "12 Jul 2026", next: "12 Sep 2026", tone: "conflict" as const, st: "Out of action (1)", log: ["Hull #4 cracked — withdrawn from rostering", "Repair quote requested", "7 of 8 still available"] },
  { item: "Windsurf boards ×10", type: "Windsurf", last: "20 Aug 2026", next: "20 Feb 2027", tone: "covered" as const, st: "Serviceable", log: ["Fins & footstraps checked", "Assigned to: Start Windsurf, Sat"] },
  { item: "Sea kayaks ×15", type: "Paddlesport", last: "01 Sep 2026", next: "01 Mar 2027", tone: "covered" as const, st: "Serviceable", log: ["Hatches & bulkheads sealed", "Spray decks counted"] },
  { item: "Buoyancy aids ×80", type: "Safety kit", last: "15 Sep 2026", next: "15 Sep 2027", tone: "covered" as const, st: "Serviceable", log: ["Buckles & stitching inspected", "Sized S–XXL, stock checked"] },
  { item: "Engine — 40hp outboard", type: "Safety boat", last: "01 Jun 2026", next: "01 Oct 2026", tone: "attention" as const, st: "Service due", log: ["100-hour service due 01 Oct", "Spare prop in store"] },
];

function DemoEquipment() {
  const [open, setOpen] = useState<string | null>("Topper ×8");
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Equipment</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ Add item</span>
      </div>
      <p className="text-sm text-slate-500">Boats, engines and safety kit — click an item to open its service log.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Serviceable</p><p className="mt-1 text-3xl font-semibold text-starboard">8</p><p className="text-xs text-slate-500">Ready to go afloat</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Service due</p><p className="mt-1 text-3xl font-semibold text-amber">2</p><p className="text-xs text-slate-500">Booked in this month</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Out of action</p><p className="mt-1 text-3xl font-semibold text-port">1</p><p className="text-xs text-slate-500">Withdrawn from rostering</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Last check</th><th className="px-4 py-3">Next service</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {KIT.map((k) => {
              const isOpen = open === k.item;
              return (
                <Fragment key={k.item}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : k.item)}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">
                      <span className="mr-1 text-xs text-slate-400">{isOpen ? "▾" : "▸"}</span>{k.item}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{k.type}</td>
                    <td className="px-4 py-3 text-slate-600">{k.last}</td>
                    <td className="px-4 py-3 text-slate-600">{k.next}</td>
                    <td className="px-4 py-3"><StatusPill tone={k.tone}>{k.st}</StatusPill></td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-canvas">
                      <td colSpan={5} className="px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service log &amp; notes</p>
                        <ul className="mt-1 space-y-1 text-sm text-slate-600">
                          {k.log.map((l) => <li key={l}>• {l}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Kit that&apos;s out of action can&apos;t be assigned to a session until it&apos;s signed back on.</p>
    </div>
  );
}

type PayRow = { n: string; sched: number; actual: number; rate: string };

const PAY: PayRow[] = [
  { n: "Sarah Whitlock", sched: 24, actual: 24, rate: "£18.00" },
  { n: "Tom Bergin", sched: 12, actual: 14, rate: "£16.50" },
  { n: "Liam O'Connor", sched: 16, actual: 16, rate: "£15.00" },
  { n: "Priya Nair", sched: 18, actual: 17, rate: "£17.00" },
  { n: "Jack Turnbull", sched: 8, actual: 8, rate: "£16.50" },
  { n: "Chloe Adeyemi", sched: 20, actual: 22, rate: "£18.00" },
  { n: "Isla Fraser", sched: 10, actual: 10, rate: "£15.50" },
  { n: "Noah Pereira", sched: 22, actual: 20, rate: "£17.50" },
];

const TS_COURSES = ["Start Sailing", "Improving Skills", "Youth Stage 2", "Adult Improver", "Powerboat L2", "Start Windsurf"];
const payAmount = (h: number, r: string) => h * parseFloat(r.replace("£", ""));

// Build an example timesheet whose actual hours sum to the row's actual total.
function timesheetFor(row: PayRow) {
  const rows: { date: string; course: string; sched: number; actual: number }[] = [];
  let remaining = row.actual;
  let day = 2;
  let i = 0;
  while (remaining > 0 && i < 12) {
    const planned = i % 2 === 0 ? 3.5 : 4;
    const actual = Math.min(remaining, planned);
    rows.push({ date: `${day} Sep`, course: TS_COURSES[(row.n.length + i) % TS_COURSES.length]!, sched: planned, actual });
    remaining -= actual;
    day += i % 3 === 2 ? 3 : 2;
    i++;
  }
  return rows;
}

function DemoFinance() {
  const [openName, setOpenName] = useState<string | null>(null);
  const grand = PAY.reduce((a, p) => a + payAmount(p.actual, p.rate), 0);
  const openRow = PAY.find((p) => p.n === openName) ?? null;
  const ts = openRow ? timesheetFor(openRow) : [];

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Finance</h2>
      <p className="text-sm text-slate-500">Course income, outstanding invoices and staff pay — September.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Course revenue</p><p className="mt-1 text-3xl font-semibold text-navy">£14,280</p><p className="text-xs text-slate-500">This month, 38 bookings</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Outstanding invoices</p><p className="mt-1 text-3xl font-semibold text-amber">£1,940</p><p className="text-xs text-slate-500">4 awaiting payment</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Staff pay to process</p><p className="mt-1 text-3xl font-semibold text-navy">£{Math.round(grand).toLocaleString()}</p><p className="text-xs text-slate-500">{PAY.length} instructors, actual hours</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-navy">Payroll — scheduled vs actual hours</h3>
          <span className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Export CSV</span>
        </div>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Scheduled</th><th className="px-4 py-3">Actual</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Pay</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PAY.map((p) => (
              <tr key={p.n} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenName(p.n)}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-teal underline decoration-teal/30 underline-offset-2">{p.n}</td>
                <td className="px-4 py-3 text-slate-600">{p.sched} h</td>
                <td className={`px-4 py-3 ${p.actual !== p.sched ? "font-semibold text-amber" : "text-slate-600"}`}>{p.actual} h</td>
                <td className="px-4 py-3 text-slate-600">{p.rate}/h</td>
                <td className="px-4 py-3 font-medium text-navy">£{payAmount(p.actual, p.rate).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-4 py-3 font-semibold text-navy" colSpan={4}>Total to pay</td>
              <td className="px-4 py-3 font-semibold text-navy">£{grand.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Click any instructor to open their full timesheet. Actual hours are captured from session sign-off, so payroll matches what really happened on the water.</p>

      {/* Timesheet modal */}
      {openRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={() => setOpenName(null)}>
          <div className="w-full max-w-lg rounded-card bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-navy">{openRow.n} — timesheet</h3>
                <p className="text-xs text-slate-500">September · {openRow.rate}/h · {openRow.actual} actual hours</p>
              </div>
              <button onClick={() => setOpenName(null)} className="text-sm text-slate-400 hover:text-slate-600">Close ✕</button>
            </div>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2">Date</th><th className="py-2">Course</th><th className="py-2 text-right">Sched</th><th className="py-2 text-right">Actual</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ts.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-600">{r.date}</td>
                    <td className="py-2 text-navy">{r.course}</td>
                    <td className="py-2 text-right text-slate-600">{r.sched} h</td>
                    <td className={`py-2 text-right ${r.actual !== r.sched ? "font-semibold text-amber" : "text-slate-600"}`}>{r.actual} h</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-2 font-semibold text-navy" colSpan={3}>Total pay ({openRow.actual} h)</td>
                  <td className="py-2 text-right font-semibold text-navy">£{payAmount(openRow.actual, openRow.rate).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DemoSettings() {
  const sections = [
    { title: "Centre details", desc: "Harbour Sailing Centre · harbour.activityroster.com · EU (GDPR) data region", items: ["Name, logo & brand colour", "Address & contact", "Season & opening times"] },
    { title: "Grades & roles", desc: "How your instructors and helpers are graded.", items: ["Senior Instructor, Instructor, Assistant", "Safety Boat Driver", "Custom volunteer roles"] },
    { title: "Compliance checks", desc: "The licences and vetting that must be valid to roster.", items: ["First Aid (mandatory)", "Safeguarding (mandatory)", "DBS / PVG / AccessNI / Garda vetting", "RYA instructor certificates"] },
    { title: "Course catalogue", desc: "RYA course types, ratios and required qualifications.", items: ["RYA National Sailing scheme", "RYA Youth Sailing scheme", "RYA Powerboat & Windsurfing", "Custom sessions"] },
    { title: "Jurisdictions & vetting", desc: "Right checks for where your staff work.", items: ["England & Wales — DBS", "Scotland — PVG", "Northern Ireland — AccessNI", "Ireland — Garda vetting"] },
    { title: "Billing", desc: "Plan, invoices and payment method.", items: ["£75/month or £750/year (2 months free)", "Update payment method", "Download invoices"] },
  ];
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Settings</h2>
      <p className="text-sm text-slate-500">
        This is where each centre shapes ActivityRoster to how it runs — grades, checks, courses and jurisdictions are all yours.
        Retired config is deactivated, never deleted, so old records still make sense.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-navy">{s.title}</h3>
              <span className="text-xs font-semibold text-teal">Edit</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{s.desc}</p>
            <ul className="mt-3 space-y-1.5">
              {s.items.map((it) => (
                <li key={it} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-teal" />{it}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time & attendance
// ---------------------------------------------------------------------------
const DEMO_NOW = "13:20";
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };
const hrs = (a: string, b: string) => ((toMin(b) - toMin(a)) / 60);

type Shift = { name: string; role: string; course: string; in: string | null; out: string | null };

function DemoTimeClock() {
  const [rows, setRows] = useState<Shift[]>([
    { name: "Sarah Whitlock", role: "Senior Instructor", course: "Start Sailing", in: "08:55", out: null },
    { name: "Dan Rees", role: "Safety Boat", course: "Start Sailing", in: "08:58", out: null },
    { name: "Chloe Adeyemi", role: "Senior Instructor", course: "Improving Skills", in: "12:50", out: null },
    { name: "Priya Nair", role: "Instructor", course: "Adult Improver (EV)", in: null, out: null },
    { name: "Tom Bergin", role: "Instructor", course: "Youth Stage 2", in: "08:50", out: "12:10" },
    { name: "Megan Foyle", role: "Senior Instructor", course: "Youth Stage 2", in: "08:52", out: "12:05" },
  ]);

  const toggle = (i: number) => setRows((rs) => rs.map((r, j) => {
    if (i !== j) return r;
    if (!r.in) return { ...r, in: DEMO_NOW };
    if (!r.out) return { ...r, out: DEMO_NOW };
    return r;
  }));

  const onWater = rows.filter((r) => r.in && !r.out).length;
  const started = rows.filter((r) => r.in).length;
  const hoursToday = rows.reduce((a, r) => a + (r.in && r.out ? hrs(r.in, r.out) : 0), 0);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Time clock</h2>
      <p className="text-sm text-slate-500">Clock-in at the boat park builds timesheets automatically — demo time is {DEMO_NOW}.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">On the water now</p><p className="mt-1 text-3xl font-semibold text-starboard">{onWater}</p><p className="text-xs text-slate-500">Clocked in, not yet out</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Started today</p><p className="mt-1 text-3xl font-semibold text-navy">{started}<span className="text-lg text-slate-400">/{rows.length}</span></p><p className="text-xs text-slate-500">Rostered instructors</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Hours logged today</p><p className="mt-1 text-3xl font-semibold text-navy">{hoursToday.toFixed(1)}</p><p className="text-xs text-slate-500">Actual, from clock-outs</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Clock in</th><th className="px-4 py-3">Clock out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const status = !r.in ? "not-started" : !r.out ? "on-water" : "done";
              return (
                <tr key={r.name} className="hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-navy">{r.name}</span><span className="block text-xs text-slate-400">{r.role}</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.course}</td>
                  <td className="px-4 py-3 text-slate-600">{r.in ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.out ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-navy">{r.in && r.out ? hrs(r.in, r.out).toFixed(1) : r.in ? hrs(r.in, DEMO_NOW).toFixed(1) : "—"}</td>
                  <td className="px-4 py-3">
                    {status === "done" ? <StatusPill tone="neutral">Signed off</StatusPill> : (
                      <button onClick={() => toggle(i)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${status === "on-water" ? "bg-port hover:opacity-90" : "bg-starboard hover:opacity-90"}`}>
                        {status === "on-water" ? "Clock out" : "Clock in"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Optional photo &amp; GPS check at clock-in confirms the instructor is on site. Actual hours flow straight into Payroll.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leave & cover (open shifts)
// ---------------------------------------------------------------------------
type LeaveStatus = "pending" | "approved" | "declined";

function DemoLeave() {
  const [leave, setLeave] = useState<{ name: string; type: string; dates: string; days: number; status: LeaveStatus }[]>([
    { name: "Liam O'Connor", type: "Annual leave", dates: "6–10 Oct", days: 5, status: "pending" },
    { name: "Isla Fraser", type: "Sick", dates: "24 Sep", days: 1, status: "pending" },
    { name: "Freya Donnelly", type: "Training (RYA)", dates: "18–19 Oct", days: 2, status: "approved" },
    { name: "Cormac Byrne", type: "Unpaid", dates: "2 Nov", days: 1, status: "pending" },
  ]);
  const setStatus = (i: number, s: LeaveStatus) => setLeave((ls) => ls.map((l, j) => (i === j ? { ...l, status: s } : l)));

  const [shifts, setShifts] = useState<{ course: string; when: string; role: string; state: "open" | "offered" | "filled"; by: string }[]>([
    { course: "Powerboat Level 2", when: "Sat 26 Sep · AM", role: "Safety Boat Driver", state: "open", by: "Dan Rees" },
    { course: "Youth Stage 2", when: "Wed 24 Sep · AM", role: "2nd Instructor", state: "offered", by: "Grace Hollis" },
    { course: "Start Windsurf", when: "Sat 26 Sep · PM", role: "Windsurf Instructor", state: "filled", by: "Hannah Leung" },
  ]);
  const advance = (i: number) => setShifts((ss) => ss.map((s, j) => {
    if (i !== j) return s;
    if (s.state === "open") return { ...s, state: "offered" };
    if (s.state === "offered") return { ...s, state: "filled" };
    return s;
  }));

  const pill = { pending: "attention", approved: "covered", declined: "conflict" } as const;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Leave &amp; cover</h2>
      <p className="text-sm text-slate-500">Approve leave and fill the gaps it leaves — with open shifts staff can claim.</p>

      <Card className="mt-4 p-0">
        <h3 className="px-4 pt-4 font-semibold text-navy">Leave requests</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leave.map((l, i) => (
              <tr key={l.name} className="hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{l.name}</td>
                <td className="px-4 py-3 text-slate-600">{l.type}</td>
                <td className="px-4 py-3 text-slate-600">{l.dates} <span className="text-xs text-slate-400">· {l.days}d</span></td>
                <td className="px-4 py-3"><StatusPill tone={pill[l.status]}>{l.status[0]!.toUpperCase() + l.status.slice(1)}</StatusPill></td>
                <td className="px-4 py-3 text-right">
                  {l.status === "pending" ? (
                    <span className="flex justify-end gap-2">
                      <button onClick={() => setStatus(i, "approved")} className="rounded-lg bg-starboard px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Approve</button>
                      <button onClick={() => setStatus(i, "declined")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Decline</button>
                    </span>
                  ) : <span className="text-xs text-slate-400">actioned</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4">
        <h3 className="font-semibold text-navy">Open shifts — cover needed</h3>
        <p className="text-xs text-slate-500">Broadcast to fit, available staff; they claim it from their app.</p>
        <div className="mt-3 space-y-2">
          {shifts.map((s, i) => (
            <div key={s.course + s.when} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-navy">{s.role} · {s.course}</p>
                <p className="text-xs text-slate-400">{s.when}</p>
              </div>
              {s.state === "filled" ? (
                <StatusPill tone="covered">Filled · {s.by}</StatusPill>
              ) : s.state === "offered" ? (
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber">{s.by} offered</span>
                  <button onClick={() => advance(i)} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Confirm</button>
                </span>
              ) : (
                <button onClick={() => advance(i)} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700">Broadcast to available</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports & analytics
// ---------------------------------------------------------------------------
function Bar({ label, value, max, sub, tone = "teal" }: { label: string; value: number; max: number; sub?: string; tone?: "teal" | "amber" | "starboard" | "navy" }) {
  const pct = Math.max(3, Math.round((value / max) * 100));
  const bg = { teal: "bg-teal", amber: "bg-amber", starboard: "bg-starboard", navy: "bg-navy" }[tone];
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs"><span className="text-slate-600">{label}</span><span className="font-semibold text-navy">{sub}</span></div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function DemoReports() {
  const weeks = [
    { w: "Wk 1", rev: 3200, cost: 1650 },
    { w: "Wk 2", rev: 3850, cost: 1820 },
    { w: "Wk 3", rev: 4100, cost: 2050 },
    { w: "Wk 4", rev: 3130, cost: 1710 },
  ];
  const maxWk = Math.max(...weeks.map((x) => x.rev));
  const util = [
    { n: "Sarah Whitlock", pct: 92 }, { n: "Chloe Adeyemi", pct: 88 }, { n: "Maya Sørensen", pct: 81 },
    { n: "Noah Pereira", pct: 74 }, { n: "Priya Nair", pct: 69 }, { n: "Liam O'Connor", pct: 58 },
  ];
  const boats = [
    { n: "Pico dinghies", pct: 84 }, { n: "RIBs (safety)", pct: 77 }, { n: "Windsurf boards", pct: 61 },
    { n: "ILCA / Laser", pct: 55 }, { n: "Sea kayaks", pct: 38 },
  ];
  const totalRev = weeks.reduce((a, x) => a + x.rev, 0);
  const totalCost = weeks.reduce((a, x) => a + x.cost, 0);
  const wagePct = Math.round((totalCost / totalRev) * 100);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Reports</h2>
      <p className="text-sm text-slate-500">Labour cost, revenue and utilisation — September. <span className="text-slate-400">Illustrative figures.</span></p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs font-semibold text-navy">Revenue</p><p className="mt-1 text-2xl font-semibold text-navy">£{totalRev.toLocaleString()}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Wage cost</p><p className="mt-1 text-2xl font-semibold text-amber">£{totalCost.toLocaleString()}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Wage % of revenue</p><p className={`mt-1 text-2xl font-semibold ${wagePct <= 55 ? "text-starboard" : "text-port"}`}>{wagePct}%</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Avg instructor use</p><p className="mt-1 text-2xl font-semibold text-navy">77%</p></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-navy">Revenue vs wage cost — by week</h3>
          {weeks.map((x) => (
            <div key={x.w} className="mb-3">
              <Bar label={`${x.w} · revenue`} value={x.rev} max={maxWk} sub={`£${x.rev.toLocaleString()}`} tone="teal" />
              <Bar label={`${x.w} · wage cost`} value={x.cost} max={maxWk} sub={`£${x.cost.toLocaleString()}`} tone="amber" />
            </div>
          ))}
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-semibold text-navy">Instructor utilisation</h3>
            {util.map((u) => <Bar key={u.n} label={u.n} value={u.pct} max={100} sub={`${u.pct}%`} tone={u.pct >= 80 ? "starboard" : "navy"} />)}
          </Card>
          <Card>
            <h3 className="mb-3 font-semibold text-navy">Boat &amp; kit utilisation</h3>
            {boats.map((b) => <Bar key={b.n} label={b.n} value={b.pct} max={100} sub={`${b.pct}%`} tone="teal" />)}
          </Card>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Every figure drills down to the sessions behind it, and exports to CSV or your accountant.</p>
    </div>
  );
}

function DemoBookings() {
  const rows = [
    { c: "Powerboat Level 2", who: "M. Fisher", places: 2, amount: "£240", status: "paid" as const },
    { c: "Start Sailing", who: "The Hendersons", places: 4, amount: "£360", status: "confirmed" as const },
    { c: "Youth Stage 2", who: "R. Okafor", places: 1, amount: "£110", status: "confirmed" as const },
    { c: "Start Windsurf", who: "A. Price", places: 2, amount: "£150", status: "provisional" as const },
    { c: "Adult Improver", who: "J. Kelly", places: 2, amount: "£180", status: "paid" as const },
    { c: "Stage 1 Junior", who: "The Walsh family", places: 3, amount: "£165", status: "provisional" as const },
  ];
  const tone = { paid: "covered", confirmed: "covered", provisional: "attention", cancelled: "conflict" } as const;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Bookings</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ New booking</span>
      </div>
      <p className="text-sm text-slate-500">Customer bookings and course revenue.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Earned revenue</p><p className="mt-1 text-3xl font-semibold text-navy">£890</p><p className="text-xs text-slate-500">Confirmed &amp; paid</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Provisional</p><p className="mt-1 text-3xl font-semibold text-amber">£315</p><p className="text-xs text-slate-500">Awaiting confirmation</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Bookings</p><p className="mt-1 text-3xl font-semibold text-navy">{rows.length}</p><p className="text-xs text-slate-500">This month</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Places</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.who + r.c} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-navy">{r.who}</td>
                <td className="px-4 py-3 text-slate-600">{r.c}</td>
                <td className="px-4 py-3 text-slate-600">{r.places}</td>
                <td className="px-4 py-3 font-medium text-navy">{r.amount}</td>
                <td className="px-4 py-3"><StatusPill tone={tone[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Confirmed &amp; paid bookings feed the revenue vs wage-cost view in Reports.</p>
    </div>
  );
}

function DemoPortal() {
  const initial: Record<string, Avail> = {
    "Mon|AM": "free", "Mon|PM": "busy", "Mon|EV": "none",
    "Tue|AM": "free", "Tue|PM": "free", "Tue|EV": "maybe",
    "Wed|AM": "free", "Wed|PM": "none", "Wed|EV": "free",
  };
  const [avail, setAvail] = useState(initial);
  const cycle: Avail[] = ["free", "maybe", "busy", "none"];
  const label: Record<Avail, string> = { free: "Free", maybe: "Maybe", busy: "Busy", none: "—" };
  const tone: Record<Avail, string> = {
    free: "bg-starboard/15 text-starboard", maybe: "bg-amber/15 text-amber", busy: "bg-port/15 text-port", none: "bg-slate-100 text-slate-400",
  };
  const tap = (k: string) => setAvail((a) => ({ ...a, [k]: cycle[(cycle.indexOf(a[k] ?? "none") + 1) % cycle.length]! }));

  return (
    <div className="flex justify-center py-6">
      <div className="w-[340px] max-w-full overflow-hidden rounded-[30px] border-[10px] border-[#0b1620] shadow-2xl">
        <div className="bg-navy px-4 py-4 text-white">
          <p className="font-display text-lg font-bold">Activity<span className="text-ryablue-bright">Roster</span></p>
          <p className="text-xs text-white/70">Harbour Sailing Centre · Sarah Whitlock</p>
        </div>
        <div className="min-h-[380px] bg-canvas p-4">
          <p className="mb-2 font-display text-lg font-semibold text-navy">My schedule</p>
          {[
            { c: "Start Sailing", t: "Mon 21 Sep · 09:00–12:30", s: "AM" },
            { c: "Improving Skills", t: "Tue 22 Sep · 13:00–16:30", s: "PM" },
            { c: "Adult Improver", t: "Wed 23 Sep · 17:30–20:00", s: "EV" },
          ].map((x) => (
            <div key={x.c} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div><p className="text-sm font-semibold text-navy">{x.c}</p><p className="text-xs text-slate-400">{x.t}</p></div>
              <StatusPill tone="neutral">{x.s}</StatusPill>
            </div>
          ))}
          <p className="mb-2 mt-4 font-display text-lg font-semibold text-navy">My availability</p>
          {["Mon", "Tue", "Wed"].map((d) => (
            <div key={d} className="mb-2 grid grid-cols-[48px_1fr_1fr_1fr] items-center gap-1.5">
              <span className="text-sm font-semibold text-navy">{d}</span>
              {(["AM", "PM", "EV"] as Slot[]).map((s) => {
                const k = `${d}|${s}`;
                const v = avail[k] ?? "none";
                return (
                  <button key={k} onClick={() => tap(k)} className={`rounded-lg py-2 text-xs font-semibold ${tone[v]}`}>
                    <span className="block text-[10px] uppercase opacity-70">{s}</span>
                    {label[v]}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="mt-1.5 text-center text-[11px] text-slate-400">Tap to cycle: Free → Maybe → Busy → clear</p>
        </div>
        <div className="flex justify-around border-t border-slate-200 bg-white py-2.5 text-[11px] text-slate-400">
          {["Schedule", "Availability", "Hours", "Documents"].map((t, i) => (
            <span key={t} className={i === 0 ? "font-semibold text-teal" : ""}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
