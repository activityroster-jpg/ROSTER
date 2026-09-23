"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, StatusPill } from "@/components/ui";

type Slot = "AM" | "PM" | "EV";
type Avail = "free" | "maybe" | "busy" | "none";
type Panel = "dash" | "courses" | "availability" | "staff" | "equipment" | "finance" | "settings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const NAV: { label: string; key: Panel }[] = [
  { label: "Dashboard", key: "dash" },
  { label: "Courses", key: "courses" },
  { label: "Availability", key: "availability" },
  { label: "Staff", key: "staff" },
  { label: "Equipment", key: "equipment" },
  { label: "Finance", key: "finance" },
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

export function DemoApp() {
  const [view, setView] = useState<"office" | "portal">("office");
  const [panel, setPanel] = useState<Panel>("dash");

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
        <Link href="/#get-demo" className="text-sm font-semibold text-teal hover:underline">
          Try this free for a month →
        </Link>
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
              {panel === "staff" ? <DemoStaff /> : null}
              {panel === "equipment" ? <DemoEquipment /> : null}
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

function DemoCourses() {
  const courses = [
    {
      name: "Powerboat Level 2", meta: "RYA Powerboat · Sat 26 Sep · 1/1 staff", tone: "conflict" as const, pill: "No safety cover",
      staff: ["Dan Rees · Instructor"], warn: "Safety boat required for this course — no safety-boat driver assigned yet.",
    },
    {
      name: "Youth Stage 2", meta: "RYA Youth Sailing · Wed 24 Sep · 1/2 staff", tone: "attention" as const, pill: "Under-staffed",
      staff: ["Megan Foyle · Senior Instructor"], warn: "Group of 12 needs 2 ratio-counting instructors — 1 more to assign.",
    },
    {
      name: "Assign to Powerboat L2", meta: "Blocked instructor flagged automatically", tone: "conflict" as const, pill: "Blocked",
      staff: [], warn: "Aoife Kelly can't be assigned: First Aid expired 30 Aug 2026. Override with a note to record it.", assign: true,
    },
    {
      name: "Start Sailing", meta: "RYA National Sailing · Mon 21 Sep · 2/2 staff", tone: "covered" as const, pill: "Covered",
      staff: ["Sarah Whitlock · Senior Instructor", "Dan Rees · Safety Boat"], warn: null,
    },
    {
      name: "Improving Skills", meta: "RYA National Sailing · Tue 22 Sep · 2/2 staff", tone: "covered" as const, pill: "Covered",
      staff: ["Chloe Adeyemi · Senior Instructor", "Liam O'Connor · Instructor"], warn: null,
    },
    {
      name: "Adult Improver", meta: "RYA National Sailing · Wed 24 Sep (EV) · 1/1 staff", tone: "covered" as const, pill: "Covered",
      staff: ["Priya Nair · Instructor"], warn: null,
    },
    {
      name: "Start Windsurfing", meta: "RYA Windsurfing · Sat 26 Sep · 2/2 staff", tone: "covered" as const, pill: "Covered",
      staff: ["Isla Fraser · Windsurf Instructor", "Hannah Leung · Windsurf Instructor"], warn: null,
    },
    {
      name: "Stage 1 Junior", meta: "RYA Youth Sailing · Sun 27 Sep · 2/2 staff", tone: "covered" as const, pill: "Covered",
      staff: ["Maya Sørensen · Senior Instructor", "Ella Munro · Assistant"], warn: null,
    },
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Courses</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ New course</span>
      </div>
      <p className="text-sm text-slate-500">This week&apos;s catalogue and staffing at a glance.</p>
      <div className="mt-4 space-y-3">
        {courses.map((c) => (
          <Card key={c.name}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-semibold text-navy">{c.name}</p><p className="text-xs text-slate-400">{c.meta}</p></div>
              <StatusPill tone={c.tone}>{c.pill}</StatusPill>
            </div>
            {c.staff.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.staff.map((s) => (
                  <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{s}</span>
                ))}
              </div>
            ) : null}
            {c.assign ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3">
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Aoife Kelly ⚠ blocked ▾</span>
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Safety Boat Driver ▾</span>
                <button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white">Assign</button>
              </div>
            ) : null}
            {c.warn ? (
              <p className={`mt-2 flex items-center gap-1.5 text-sm ${c.tone === "conflict" ? "text-port" : "text-amber"}`}>● {c.warn}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

const AVAIL_CFG: Record<string, { label: string; cls: string }> = {
  f: { label: "Free", cls: "bg-starboard/15 text-starboard" },
  a: { label: "AM", cls: "bg-teal/15 text-teal" },
  p: { label: "PM", cls: "bg-ryablue-bright/15 text-ryablue-dark" },
  b: { label: "Busy", cls: "bg-port/15 text-port" },
  o: { label: "—", cls: "bg-slate-100 text-slate-300" },
};

function DemoAvailability() {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Availability</h2>
      <p className="text-sm text-slate-500">
        Who&apos;s available this week — submitted by staff in the instructor portal. {STAFF.length} staff shown.
      </p>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {(["f", "a", "p", "b", "o"] as const).map((k) => (
          <span key={k} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${AVAIL_CFG[k]!.cls}`}>
            {AVAIL_CFG[k]!.label}
          </span>
        ))}
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold">Instructor</th>
              {DAYS.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-semibold">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAFF.map((s) => (
              <tr key={s.n} className="hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-navy">
                  <span className="whitespace-nowrap">{s.n}</span>
                  {s.lic === "blocked" ? <span className="ml-1 align-middle text-port" title="Blocked from rostering">●</span> : null}
                </td>
                {s.pat.split("").map((code, i) => {
                  const cfg = AVAIL_CFG[code] ?? AVAIL_CFG.o;
                  return (
                    <td key={i} className="px-1 py-1 text-center">
                      <span className={`inline-block w-full rounded-md py-1 font-semibold ${cfg!.cls}`}>{cfg!.label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">
        In the live app, drag across a course to auto-suggest available, fit-to-roster instructors.
      </p>
    </div>
  );
}

const LIC_PILL: Record<Lic, { tone: "covered" | "conflict" | "attention"; label: string }> = {
  up: { tone: "covered", label: "Up to date" },
  expiring: { tone: "attention", label: "Expiring soon" },
  blocked: { tone: "conflict", label: "Blocked" },
};

function DemoStaff() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Staff</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ Add staff</span>
      </div>
      <p className="text-sm text-slate-500">{STAFF.length} instructors · RYA qualifications and licence status.</p>

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
              <tr key={s.n} className="hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{s.n}</td>
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
    </div>
  );
}

function DemoEquipment() {
  const kit = [
    { item: "RIB safety boat — “Kestrel”", type: "Safety boat", last: "18 Sep 2026", next: "18 Dec 2026", tone: "covered" as const, st: "Serviceable" },
    { item: "RIB safety boat — “Merlin”", type: "Safety boat", last: "02 Aug 2026", next: "28 Sep 2026", tone: "attention" as const, st: "Service due" },
    { item: "Pico dinghies ×12", type: "Dinghy", last: "10 Sep 2026", next: "10 Mar 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "ILCA / Laser ×6", type: "Dinghy", last: "10 Sep 2026", next: "10 Mar 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "Wayfarer ×4", type: "Dinghy", last: "05 Sep 2026", next: "05 Mar 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "Topper ×8", type: "Dinghy", last: "12 Jul 2026", next: "12 Sep 2026", tone: "conflict" as const, st: "Out of action (1)" },
    { item: "Windsurf boards ×10", type: "Windsurf", last: "20 Aug 2026", next: "20 Feb 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "Sea kayaks ×15", type: "Paddlesport", last: "01 Sep 2026", next: "01 Mar 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "Buoyancy aids ×80", type: "Safety kit", last: "15 Sep 2026", next: "15 Sep 2027", tone: "covered" as const, st: "Serviceable" },
    { item: "Engine — 40hp outboard", type: "Safety boat", last: "01 Jun 2026", next: "01 Oct 2026", tone: "attention" as const, st: "Service due" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-navy">Equipment</h2>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">+ Add item</span>
      </div>
      <p className="text-sm text-slate-500">Boats, engines and safety kit with service and inspection dates.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Serviceable</p><p className="mt-1 text-3xl font-semibold text-starboard">7</p><p className="text-xs text-slate-500">Ready to go afloat</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Service due</p><p className="mt-1 text-3xl font-semibold text-amber">2</p><p className="text-xs text-slate-500">Booked in this month</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Out of action</p><p className="mt-1 text-3xl font-semibold text-port">1</p><p className="text-xs text-slate-500">Withdrawn from rostering</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Last check</th><th className="px-4 py-3">Next service</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kit.map((k) => (
              <tr key={k.item} className="hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{k.item}</td>
                <td className="px-4 py-3 text-slate-600">{k.type}</td>
                <td className="px-4 py-3 text-slate-600">{k.last}</td>
                <td className="px-4 py-3 text-slate-600">{k.next}</td>
                <td className="px-4 py-3"><StatusPill tone={k.tone}>{k.st}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Kit that&apos;s out of action can&apos;t be assigned to a session until it&apos;s signed back on.</p>
    </div>
  );
}

function DemoFinance() {
  const pay = [
    { n: "Sarah Whitlock", sched: 24, actual: 24, rate: "£18.00" },
    { n: "Tom Bergin", sched: 12, actual: 14, rate: "£16.50" },
    { n: "Liam O'Connor", sched: 16, actual: 16, rate: "£15.00" },
    { n: "Priya Nair", sched: 18, actual: 17, rate: "£17.00" },
    { n: "Jack Turnbull", sched: 8, actual: 8, rate: "£16.50" },
    { n: "Chloe Adeyemi", sched: 20, actual: 22, rate: "£18.00" },
    { n: "Isla Fraser", sched: 10, actual: 10, rate: "£15.50" },
    { n: "Noah Pereira", sched: 22, actual: 20, rate: "£17.50" },
  ];
  const total = (h: number, r: string) => h * parseFloat(r.replace("£", ""));
  const grand = pay.reduce((a, p) => a + total(p.actual, p.rate), 0);
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Finance</h2>
      <p className="text-sm text-slate-500">Course income, outstanding invoices and staff pay — September.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">Course revenue</p><p className="mt-1 text-3xl font-semibold text-navy">£14,280</p><p className="text-xs text-slate-500">This month, 38 bookings</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Outstanding invoices</p><p className="mt-1 text-3xl font-semibold text-amber">£1,940</p><p className="text-xs text-slate-500">4 awaiting payment</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Staff pay to process</p><p className="mt-1 text-3xl font-semibold text-navy">£{Math.round(grand).toLocaleString()}</p><p className="text-xs text-slate-500">{pay.length} instructors, actual hours</p></Card>
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
            {pay.map((p) => (
              <tr key={p.n} className="hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{p.n}</td>
                <td className="px-4 py-3 text-slate-600">{p.sched} h</td>
                <td className={`px-4 py-3 ${p.actual !== p.sched ? "font-semibold text-amber" : "text-slate-600"}`}>{p.actual} h</td>
                <td className="px-4 py-3 text-slate-600">{p.rate}/h</td>
                <td className="px-4 py-3 font-medium text-navy">£{total(p.actual, p.rate).toFixed(2)}</td>
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
      <p className="mt-2 text-xs text-slate-400">Actual hours are captured from the session sign-off, so payroll matches what really happened on the water.</p>
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
    { title: "Billing", desc: "Plan, invoices and payment method.", items: ["Basic plan · £55/month", "Update payment method", "Download invoices"] },
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
