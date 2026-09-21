"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, StatusPill } from "@/components/ui";

type Slot = "AM" | "PM" | "EV";
type Avail = "free" | "maybe" | "busy" | "none";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const [panel, setPanel] = useState<"dash" | "courses" | "staff">("dash");

  return (
    <div>
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
          Get this for your centre →
        </Link>
      </div>

      {view === "office" ? (
        <div className="overflow-hidden rounded-card border border-slate-200 shadow-sm">
          <div className="grid md:grid-cols-[200px_1fr]">
            <aside className="hidden bg-navy p-4 text-white md:block">
              <p className="font-display text-lg font-bold">
                Activity<span className="text-teal">Roster</span>
              </p>
              <p className="mb-3 border-b border-white/10 pb-3 text-xs text-white/60">Harbour Sailing Centre</p>
              {["Dashboard", "Courses", "Availability", "Staff", "Equipment", "Finance", "Settings"].map((n) => {
                const active = (panel === "dash" && n === "Dashboard") || (panel === "courses" && n === "Courses") || (panel === "staff" && n === "Staff");
                const go = n === "Dashboard" ? "dash" : n === "Courses" ? "courses" : n === "Staff" ? "staff" : null;
                return (
                  <button
                    key={n}
                    onClick={() => go && setPanel(go as typeof panel)}
                    className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10"}`}
                  >
                    <span className={`h-3.5 w-3.5 rounded ${active ? "bg-teal" : "bg-white/25"}`} />
                    {n}
                  </button>
                );
              })}
            </aside>

            <div className="bg-canvas p-5">
              <div className="mb-4 flex gap-2 md:hidden">
                {(["dash", "courses", "staff"] as const).map((p) => (
                  <button key={p} onClick={() => setPanel(p)} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${panel === p ? "border-teal bg-teal text-white" : "border-slate-200 bg-white text-slate-500"}`}>
                    {p === "dash" ? "Dashboard" : p === "courses" ? "Courses" : "Staff"}
                  </button>
                ))}
              </div>

              {panel === "dash" ? <DemoDashboard /> : panel === "courses" ? <DemoCourses /> : <DemoStaff />}
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
      <p className="text-sm text-slate-500">Harbour Sailing Centre · this week</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Staff blocked</p><p className="mt-1 text-3xl font-semibold text-port">1</p><p className="text-xs text-slate-400">Lapsed mandatory checks</p></Card>
        <Card><p className="text-sm text-slate-500">Checks expiring</p><p className="mt-1 text-3xl font-semibold text-amber">2</p><p className="text-xs text-slate-400">Within alert window</p></Card>
        <Card><p className="text-sm text-slate-500">Needs attention</p><p className="mt-1 text-3xl font-semibold text-amber">2</p><p className="text-xs text-slate-400">Under-staffed / no cover</p></Card>
      </div>

      <Card className="mt-4 overflow-x-auto">
        <h3 className="mb-3 font-semibold text-navy">This week</h3>
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
        <h3 className="mb-1 font-semibold text-navy">Coverage</h3>
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
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Courses</h2>
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold text-navy">Powerboat Level 2</p><p className="text-xs text-slate-400">RYA Powerboat · scheduled · 1/1 staff</p></div>
          <StatusPill tone="conflict">No safety cover</StatusPill>
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Dan Rees · Instructor</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-3">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Aoife Kelly ⚠ blocked ▾</span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">Safety Boat Driver ▾</span>
          <button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white">Assign</button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-port">● Not fit to roster: First Aid expired (30 Aug 2026). Override with a note to record it.</p>
      </Card>
      <Card className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div><p className="font-semibold text-navy">Start Sailing</p><p className="text-xs text-slate-400">RYA National Sailing · confirmed · 2/2 staff</p></div>
          <StatusPill tone="covered">Covered</StatusPill>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Sarah Whitlock · Senior Instructor</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Dan Rees · Safety Boat <span className="text-amber">(override)</span></span>
        </div>
      </Card>
    </div>
  );
}

function DemoStaff() {
  const rows = [
    { n: "Sarah Whitlock", e: "Employed", fit: "fit" as const, note: "—" },
    { n: "Tom Bergin", e: "Freelance", fit: "expiring" as const, note: "Safeguarding expires 12 Oct" },
    { n: "Aoife Kelly", e: "Employed", fit: "blocked" as const, note: "First Aid expired" },
    { n: "Dan Rees", e: "Volunteer", fit: "fit" as const, note: "—" },
  ];
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-navy">Staff</h2>
      <Card className="mt-4 p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Employment</th><th className="px-4 py-3">Fit to roster</th><th className="px-4 py-3">Notes</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.n}>
                <td className="px-4 py-3 font-medium text-navy">{r.n}</td>
                <td className="px-4 py-3 text-slate-600">{r.e}</td>
                <td className="px-4 py-3">
                  {r.fit === "fit" ? <StatusPill tone="covered">Fit</StatusPill> : r.fit === "blocked" ? <StatusPill tone="conflict">Blocked</StatusPill> : (<><StatusPill tone="covered">Fit</StatusPill> <StatusPill tone="attention">1 expiring</StatusPill></>)}
                </td>
                <td className={`px-4 py-3 ${r.fit === "blocked" ? "text-port" : "text-slate-600"}`}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
          <p className="font-display text-lg font-bold">Activity<span className="text-teal">Roster</span></p>
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
