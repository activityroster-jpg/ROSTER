"use client";

import { useMemo, useState } from "react";
import { Bell, Search, Settings2, ChevronsUpDown } from "lucide-react";
import { Card, StatusPill } from "@/components/ui";
import { Logo } from "@/components/Logo";

// ---------------------------------------------------------------------------
// This interactive demo mirrors the real office app (app/(app)/office/*). The
// panels reuse the same Card / StatusPill primitives and reproduce each real
// page's layout with example data, so what a prospect sees here matches the
// product. Nothing is saved.
// ---------------------------------------------------------------------------

type Panel =
  | "dash" | "courses" | "availability" | "timeclock" | "leave"
  | "staff" | "equipment" | "locations" | "finance"
  | "settings" | "billing" | "coursesetup" | "changelog"
  // Reached from within a panel, as in the real app (printable rota from the
  // Dashboard, Integrations from Courses).
  | "rota" | "integrations";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DNUM = ["22", "23", "24", "25", "26", "27", "28"]; // week of 22 Sep
const SLOTS = ["AM", "PM", "EV"] as const;
type Slot = (typeof SLOTS)[number];
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };

// Mirrors the real office sidebar exactly (app/(app)/office/layout.tsx).
const NAV_GROUPS: { group: string; items: { label: string; key: Panel }[] }[] = [
  { group: "Operate", items: [
    { label: "Dashboard", key: "dash" },
    { label: "Courses", key: "courses" },
    { label: "Availability", key: "availability" },
    { label: "Time clock", key: "timeclock" },
    { label: "Leave & cover", key: "leave" },
  ] },
  { group: "Resources", items: [
    { label: "Staff", key: "staff" },
    { label: "Equipment", key: "equipment" },
    { label: "Locations", key: "locations" },
    { label: "Payroll", key: "finance" },
  ] },
  { group: "Configure", items: [
    { label: "Settings", key: "settings" },
    { label: "Billing", key: "billing" },
    { label: "Course setup", key: "coursesetup" },
    { label: "Change log", key: "changelog" },
  ] },
];
const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);

// --- Shared example data ----------------------------------------------------

type Ev = { id: string; dayIdx: number; time: string; name: string; aud: "youth" | "adult" | "all" };
const EVENTS: Ev[] = [
  { id: "e1", dayIdx: 0, time: "09:00", name: "Start Sailing", aud: "adult" },
  { id: "e2", dayIdx: 1, time: "13:00", name: "Improving Skills", aud: "adult" },
  { id: "e3", dayIdx: 2, time: "09:00", name: "Youth Stage 2", aud: "youth" },
  { id: "e4", dayIdx: 2, time: "17:30", name: "Adult Improver", aud: "adult" },
  { id: "e5", dayIdx: 3, time: "13:00", name: "Youth Stage 2", aud: "youth" },
  { id: "e6", dayIdx: 4, time: "09:00", name: "Start Sailing", aud: "adult" },
  { id: "e7", dayIdx: 5, time: "09:00", name: "Powerboat L2", aud: "adult" },
  { id: "e8", dayIdx: 5, time: "13:00", name: "Start Windsurf", aud: "adult" },
  { id: "e9", dayIdx: 6, time: "10:00", name: "Stage 1 Junior", aud: "youth" },
];
const audTint = (a: string) => a === "youth" ? "border-l-amber bg-amber/10 text-amber" : a === "adult" ? "border-l-teal bg-teal/10 text-teal" : "border-l-slate-400 bg-slate-100 text-slate-600";
const audBadge = (a: string) => a === "youth" ? "bg-amber/15 text-amber" : a === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500";

type Staff = { n: string; email: string | null; emp: string; teaches: string[]; youth: boolean; adult: boolean; fit: boolean; warn: number; block: string };
const STAFF: Staff[] = [
  { n: "Sarah Whitlock", email: "sarah@harboursailing.co.uk", emp: "employed", teaches: ["Start Sailing", "Powerboat L2"], youth: false, adult: true, fit: true, warn: 0, block: "" },
  { n: "Tom Bergin", email: "tom@harboursailing.co.uk", emp: "freelance", teaches: ["Youth Stage 2", "Start Windsurf"], youth: true, adult: true, fit: false, warn: 1, block: "Safeguarding expired" },
  { n: "Aoife Kelly", email: "aoife@harboursailing.co.uk", emp: "employed", teaches: ["Youth Stage 2", "Powerboat L2"], youth: true, adult: true, fit: false, warn: 0, block: "First Aid expired" },
  { n: "Dan Rees", email: null, emp: "volunteer", teaches: ["Powerboat L2"], youth: false, adult: true, fit: true, warn: 0, block: "" },
  { n: "Megan Foyle", email: "megan@harboursailing.co.uk", emp: "employed", teaches: ["Start Sailing", "Youth Stage 2"], youth: true, adult: true, fit: true, warn: 0, block: "" },
  { n: "Liam O'Connor", email: "liam@harboursailing.co.uk", emp: "freelance", teaches: ["Start Sailing"], youth: false, adult: true, fit: true, warn: 1, block: "" },
  { n: "Priya Nair", email: "priya@harboursailing.co.uk", emp: "employed", teaches: ["Start Windsurf", "Adult Improver"], youth: false, adult: true, fit: true, warn: 0, block: "" },
  { n: "Grace Hollis", email: "grace@harboursailing.co.uk", emp: "volunteer", teaches: [], youth: false, adult: false, fit: true, warn: 0, block: "" },
];

const DEMO_ALERTS = [
  { title: "Leave approved", body: "Liam O'Connor — 6–10 Oct", tone: "starboard" },
  { title: "Shift claimed", body: "Grace Hollis offered Sat safety-boat cover", tone: "teal" },
  { title: "Ticket expiring", body: "Tom Bergin — Safeguarding expires 12 Oct", tone: "amber" },
];

// ---------------------------------------------------------------------------

export function DemoApp() {
  const [view, setView] = useState<"office" | "portal">("office");
  const [panel, setPanel] = useState<Panel>("dash");
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-card border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-[#8a6314]">
        <span aria-hidden>👀</span>
        <p>
          <span className="font-semibold">This is a read-only mock-up</span> with example data, showing the real
          ActivityRoster office. Clicking around won&apos;t change or save anything.
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
          <a href="/#get-demo" className="text-sm font-semibold text-teal hover:underline">
            Try this free for a month →
          </a>
        </div>
      </div>

      {view === "office" ? (
        <div className="overflow-hidden rounded-card border border-slate-200 shadow-sm">
          <div className="grid md:grid-cols-[220px_1fr]">
            <aside className="hidden bg-navy p-4 text-white md:block">
              <Logo variant="onDark" size="sm" />
              <p className="mb-3 mt-1 border-b border-white/10 pb-3 text-xs text-white/60">Harbour Sailing Centre</p>
              {NAV_GROUPS.map((section) => (
                <div key={section.group} className="mb-4">
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">{section.group}</p>
                  {section.items.map((item) => {
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
                </div>
              ))}
            </aside>

            <div className="bg-canvas p-5">
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
                {NAV_FLAT.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setPanel(item.key)}
                    className={`flex-none rounded-lg border px-3 py-1.5 text-sm font-semibold ${panel === item.key ? "border-teal bg-teal text-white" : "border-slate-200 bg-white text-slate-500"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {panel === "dash" ? <DemoDashboard onOpen={setPanel} /> : null}
              {panel === "courses" ? <DemoCourses onOpen={setPanel} /> : null}
              {panel === "rota" ? <DemoRota onBack={() => setPanel("dash")} /> : null}
              {panel === "availability" ? <DemoAvailability /> : null}
              {panel === "timeclock" ? <DemoTimeClock /> : null}
              {panel === "leave" ? <DemoLeave /> : null}
              {panel === "staff" ? <DemoStaff /> : null}
              {panel === "equipment" ? <DemoEquipment /> : null}
              {panel === "locations" ? <DemoLocations /> : null}
              {panel === "integrations" ? <DemoIntegrations onBack={() => setPanel("courses")} /> : null}
              {panel === "finance" ? <DemoFinance /> : null}
              {panel === "settings" ? <DemoSettings /> : null}
              {panel === "billing" ? <DemoBilling /> : null}
              {panel === "coursesetup" ? <DemoCourseSetup /> : null}
              {panel === "changelog" ? <DemoChangeLog /> : null}
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

// --- Shared bits ------------------------------------------------------------

function Tile({ label, value, sub, tone = "navy" }: { label: string; value: string | number; sub: string; tone?: "navy" | "port" | "amber" | "starboard" | "teal" }) {
  const valTone = { navy: "text-navy", port: "text-port", amber: "text-amber", starboard: "text-starboard", teal: "text-teal" }[tone];
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valTone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

/** A big, read-only week calendar matching WeekCalendarView. */
function WeekCalendar() {
  const today = 2; // Wed highlighted
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50" aria-label="Previous week">←</button>
        <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">22 Sep – 28 Sep · this week</span>
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50" aria-label="Next week">→</button>
        <span className="ml-auto rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white"><span aria-hidden>＋</span> New course</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((d, i) => {
          const evs = EVENTS.filter((e) => e.dayIdx === i);
          const isToday = i === today;
          return (
            <div key={d} className={`min-h-[8rem] rounded-lg border p-1.5 ${isToday ? "border-teal bg-teal/5" : "border-slate-100 bg-slate-50/40"}`}>
              <div className="mb-1.5 text-center">
                <div className="text-[11px] font-semibold uppercase text-slate-400">{d}</div>
                <div className={`text-sm font-bold ${isToday ? "text-teal" : "text-navy"}`}>{DNUM[i]}</div>
              </div>
              {evs.length === 0 ? <p className="text-center text-[10px] text-slate-300">—</p> : evs.map((e) => (
                <div key={e.id} className={`mb-1 block rounded border-l-4 px-1.5 py-1 text-[11px] leading-tight ${audTint(e.aud)}`}>
                  <span className="block font-semibold">{e.time}</span>
                  <span className="block truncate">{e.name}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Dashboard --------------------------------------------------------------

function DemoDashboard({ onOpen }: { onOpen: (p: Panel) => void }) {
  const rota = [
    { day: "Mon 22 Sep", items: [{ slot: "AM", time: "09:00", aud: "adult", name: "Start Sailing", staff: "Sarah Whitlock, Dan Rees", cover: true }] },
    { day: "Tue 23 Sep", items: [{ slot: "PM", time: "13:00", aud: "adult", name: "Improving Skills", staff: "Chloe Adeyemi, Liam O'Connor", cover: true }] },
    { day: "Wed 24 Sep", items: [
      { slot: "AM", time: "09:00", aud: "youth", name: "Youth Stage 2", staff: "Megan Foyle", cover: false },
      { slot: "EV", time: "17:30", aud: "adult", name: "Adult Improver", staff: "Priya Nair", cover: true },
    ] },
    { day: "Sat 27 Sep", items: [
      { slot: "AM", time: "09:00", aud: "adult", name: "Powerboat L2", staff: "Dan Rees", cover: false },
      { slot: "PM", time: "13:00", aud: "adult", name: "Start Windsurf", staff: "Isla Fraser, Hannah Leung", cover: true },
    ] },
  ];
  const coverage = [
    { name: "Youth Stage 2 · Wed", type: "RYA Youth Sailing", tone: "attention" as const, label: "Under-staffed", sub: "1/2 staff" },
    { name: "Powerboat Level 2 · Sat", type: "RYA Powerboat", tone: "conflict" as const, label: "No safety cover", sub: "safety boat required" },
    { name: "Start Sailing · Mon", type: "RYA National Sailing", tone: "covered" as const, label: "Covered", sub: "2/2 staff" },
    { name: "Start Windsurf · Sat", type: "RYA Windsurfing", tone: "covered" as const, label: "Covered", sub: "2/2 staff" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-navy">Dashboard</h1>
        <p className="text-sm text-slate-500">Harbour Sailing Centre · week of 22 Sep</p>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Today</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Tile label="On the water now" value={2} sub="Clocked in" tone="starboard" />
        <Tile label="Hours logged today" value="6.5" sub="4 started" />
        <Tile label="Sessions this week" value={9} sub="View / print rota" tone="teal" />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Needs attention</p>
      <div className="mb-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Not cleared to roster" value={2} sub="Missing / expired checks" tone="port" />
        <Tile label="Checks expiring" value={4} sub="Within lead time" tone="amber" />
        <Tile label="Courses to cover" value={2} sub="Understaffed / no cover" tone="amber" />
        <Tile label="Leave to approve" value={2} sub="Pending requests" tone="amber" />
        <Tile label="Open shifts" value={1} sub="Need cover" tone="amber" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Calendar</h2>
        <button onClick={() => onOpen("courses")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Plan courses →</button>
      </div>
      <div className="mb-8"><WeekCalendar /></div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">This week&apos;s rota</h2>
        <button onClick={() => onOpen("rota")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Full rota · print / PDF →</button>
      </div>
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {rota.map((day) => (
            <div key={day.day} className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{day.day}</p>
              <ul className="space-y-1.5">
                {day.items.map((s) => (
                  <li key={s.slot + s.time} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="w-28 flex-none font-medium text-navy">{SLOT_LABEL[s.slot]} <span className="text-xs font-normal text-slate-400">{s.time}</span></span>
                    <span className="min-w-[10rem] flex-1">
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${audBadge(s.aud)}`}>{s.aud === "youth" ? "Youth" : "Adult"}</span>
                      <span className="font-medium text-navy">{s.name}</span>
                    </span>
                    <span className="text-xs text-slate-500">{s.staff}</span>
                    {!s.cover ? <StatusPill tone="attention">Needs cover</StatusPill> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-navy">Coverage</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {coverage.map((c) => (
            <Card key={c.name} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">{c.name}</p>
                <p className="text-xs text-slate-500">{c.type}</p>
              </div>
              <div className="text-right">
                <StatusPill tone={c.tone}>{c.label}</StatusPill>
                <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Courses ----------------------------------------------------------------

type DemoCourse = { name: string; type: string; aud: "youth" | "adult"; sessions: string[]; staff: string[]; tone: "covered" | "attention" | "conflict"; pill: string };
const COURSE_WEEKS: { label: string; courses: DemoCourse[] }[] = [
  { label: "Week of 22 Sep – 28 Sep", courses: [
    { name: "Start Sailing", type: "RYA National Sailing", aud: "adult", sessions: ["Mon 22 Sep · 09:00–12:30", "Tue 23 Sep · 09:00–12:30"], staff: ["Sarah Whitlock · Senior Instructor", "Dan Rees · Safety Boat"], tone: "covered", pill: "Covered" },
    { name: "Youth Stage 2", type: "RYA Youth Sailing", aud: "youth", sessions: ["Wed 24 Sep · 09:00–12:00", "Thu 25 Sep · 13:00–15:30"], staff: ["Megan Foyle · Senior Instructor"], tone: "attention", pill: "Under-staffed" },
    { name: "Powerboat Level 2", type: "RYA Powerboat", aud: "adult", sessions: ["Sat 27 Sep · 09:00–12:30"], staff: ["Dan Rees · Instructor"], tone: "conflict", pill: "No safety cover" },
    { name: "Start Windsurfing", type: "RYA Windsurfing", aud: "adult", sessions: ["Sat 27 Sep · 13:00–16:30"], staff: ["Isla Fraser · Windsurf Instructor", "Hannah Leung · Windsurf Instructor"], tone: "covered", pill: "Covered" },
  ] },
];

function DemoCourses({ onOpen }: { onOpen: (p: Panel) => void }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-navy">Courses</h1>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-500">6 scheduled</span>
          <button onClick={() => onOpen("integrations")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">Connect a booking system</button>
          <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">Import from spreadsheet / calendar</span>
        </div>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Add a course, then assign staff to it. Youth and adult courses are labelled so they never get mixed up. We check
        instructor qualifications, ratios &amp; safety-boat cover and double-bookings as you go — anything short is flagged.
      </p>

      {/* Planner: calendar + builder */}
      <div className="mb-6 space-y-4">
        <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-1 font-display text-lg font-semibold text-navy">Calendar</h2>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50" aria-label="Previous week">←</button>
            <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">22 Sep – 28 Sep · this week</span>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50" aria-label="Next week">→</button>
            <span className="ml-auto text-xs text-slate-400">Tap any day to add a session to the course you&apos;re building below.</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {DAYS.map((d, i) => {
              const evs = EVENTS.filter((e) => e.dayIdx === i);
              const isToday = i === 2;
              return (
                <div key={d} className={`flex min-h-[11rem] flex-col rounded-lg border p-1.5 ${isToday ? "border-teal bg-teal/5" : "border-slate-100 bg-slate-50/50"}`}>
                  <div className="mb-1.5 text-center">
                    <div className="text-[11px] font-semibold uppercase text-slate-400">{d}</div>
                    <div className={`text-sm font-bold ${isToday ? "text-teal" : "text-navy"}`}>{DNUM[i]}</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    {evs.map((e) => (
                      <div key={e.id} className={`rounded border-l-4 px-1.5 py-1 text-[11px] leading-tight ${audTint(e.aud)}`}>
                        <span className="block font-semibold">{e.time}</span>
                        <span className="block truncate">{e.name}</span>
                      </div>
                    ))}
                  </div>
                  <span className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-teal/40 bg-teal/5 py-1 text-[11px] font-semibold text-teal"><span aria-hidden>＋</span> Add</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-navy">Add a course</h2>
          <p className="mb-3 text-xs text-slate-500">Give it a name, pick the type, then add each session — any days and times you like.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Course type</label>
              <div className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">Select…</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Course name <span className="text-slate-400">(optional)</span></label>
              <div className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">e.g. Aug Half-Term Kids Camp</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white">Create course</span>
          </div>
        </div>
      </div>

      {/* Course list */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-navy">Courses</h2>
        <div className="ml-2 flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <span className="rounded-md bg-navy px-3 py-1 font-medium text-white">Upcoming (6)</span>
          <span className="rounded-md px-3 py-1 font-medium text-slate-500">Past (14)</span>
        </div>
      </div>

      <div className="space-y-5">
        <div className="mb-3 flex items-center gap-3 border-b-2 border-navy/10 pb-2">
          <span className="h-6 w-1.5 flex-none rounded-full bg-teal" />
          <h3 className="font-display text-xl font-bold text-navy">September 2026</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">4 courses</span>
        </div>
        {COURSE_WEEKS.map((w) => (
          <div key={w.label}>
            <div className="mb-2 flex items-center justify-between rounded-lg bg-navy px-3 py-1.5">
              <span className="font-display text-sm font-bold text-white">{w.label}</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">{w.courses.length} courses</span>
            </div>
            <div className="space-y-2">
              {w.courses.map((c) => (
                <Card key={c.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy">
                        <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${audBadge(c.aud)}`}>{c.aud === "youth" ? "Youth" : "Adult"}</span>
                        {c.name}
                      </p>
                      <p className="text-xs text-slate-400">{c.type} · {c.sessions.join(" · ")}</p>
                    </div>
                    <StatusPill tone={c.tone}>{c.pill}</StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.staff.map((s) => <span key={s} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{s}</span>)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Weekly rota (printable) ------------------------------------------------

function DemoRota({ onBack }: { onBack: () => void }) {
  const staffFor: Record<string, string[]> = {
    "Start Sailing": ["Sarah Whitlock (SI)", "Dan Rees (Safety Boat)"],
    "Improving Skills": ["Chloe Adeyemi (SI)", "Liam O'Connor (DI)"],
    "Youth Stage 2": ["Megan Foyle (SI)", "— 2nd instructor needed"],
    "Adult Improver": ["Priya Nair (DI)"],
    "Powerboat L2": ["Dan Rees (PBI)", "— safety boat needed"],
    "Start Windsurf": ["Isla Fraser (WI)", "Hannah Leung (WI)"],
    "Stage 1 Junior": ["Maya Sørensen (SI)", "Ella Munro (AI)"],
  };
  return (
    <div>
      <button onClick={onBack} className="mb-2 text-xs text-slate-400 hover:text-slate-600">← Dashboard</button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-navy">Weekly rota</h1>
        <div className="flex gap-2">
          <span className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">🖨 Print / Save PDF</span>
          <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy">Export hours (CSV)</span>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500">Harbour Sailing Centre · week of 22 Sep · every session, who&apos;s on, and the cover status.</p>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Day</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Staff on</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENTS.map((e) => {
              const staff = staffFor[e.name] ?? ["—"];
              const under = staff.some((s) => s.startsWith("—"));
              const tone: "covered" | "attention" | "conflict" = e.name === "Powerboat L2" ? "conflict" : under ? "attention" : "covered";
              const label = e.name === "Powerboat L2" ? "No safety cover" : under ? "Under-staffed" : "Covered";
              return (
                <tr key={e.id} className="align-top hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{DAYS[e.dayIdx]} {DNUM[e.dayIdx]} <span className="text-xs text-slate-400">{e.time}</span></td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${audBadge(e.aud)}`}>{e.aud === "youth" ? "Youth" : "Adult"}</span>{e.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{staff.map((s) => <span key={s} className="block">{s}</span>)}</td>
                  <td className="px-4 py-3"><StatusPill tone={tone}>{label}</StatusPill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Print a clean one-page rota for the wall, or export actual hours straight to payroll. Flip to any week, past or future.</p>
    </div>
  );
}

// --- Availability (matrix) --------------------------------------------------

const AVAIL_CELL: Record<string, { label: string; cls: string }> = {
  free: { label: "✓", cls: "bg-starboard/15 text-starboard hover:bg-starboard/25" },
  maybe: { label: "~", cls: "bg-amber/15 text-amber hover:bg-amber/25" },
  busy: { label: "✕", cls: "bg-port/15 text-port hover:bg-port/25" },
  none: { label: "·", cls: "bg-slate-50 text-slate-300 hover:bg-slate-100" },
};
function availState(si: number, di: number, shi: number): "free" | "maybe" | "busy" | "none" {
  const h = (si * 7 + di * 5 + shi * 11 + si * shi) % 10;
  return h < 5 ? "free" : h < 7 ? "maybe" : h < 9 ? "none" : "busy";
}
const ROSTERED = new Set(["0|0|0", "3|0|0", "4|2|0", "6|2|2", "0|5|0"]);

function DemoAvailability() {
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Availability</h1>
      <p className="mb-4 text-sm text-slate-500">
        Who&apos;s available — submitted by instructors in their app. Hover a <span className="font-medium text-navy">●</span> to see what they&apos;re rostered on, or <span className="font-medium text-navy">click any slot</span> to fill an open shift with that instructor.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">← Previous</span>
        <span className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white">22 Sep – 28 Sep · this week</span>
        <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Next →</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-starboard/15 px-2.5 py-0.5 font-medium text-starboard">✓ Free</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 font-medium text-amber">~ Maybe</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-port/15 px-2.5 py-0.5 font-medium text-port">✕ Busy</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-400">— Not set</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-0.5 font-medium text-navy">● Rostered</span>
      </div>

      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="border-collapse text-center text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th rowSpan={3} className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold">Instructor</th>
              {DAYS.map((d, i) => (
                <th key={d} colSpan={3} className="border-l border-slate-200 px-1 py-2 text-sm font-bold text-navy">{d} <span className="font-normal text-slate-400">{DNUM[i]}</span></th>
              ))}
            </tr>
            <tr className="bg-slate-50 text-xs text-slate-400">
              {DAYS.map((_, di) => SLOTS.map((s, si) => (
                <th key={`${di}-${s}`} className={`w-12 px-1 py-1 font-semibold ${si === 0 ? "border-l border-slate-200" : ""}`}>{s}</th>
              )))}
            </tr>
            <tr className="bg-slate-50">
              {DAYS.map((_, di) => SLOTS.map((s, si) => {
                const n = STAFF.filter((_st, idx) => availState(idx, di, si) === "free").length;
                return <th key={`c${di}-${s}`} className={`px-1 pb-1.5 text-xs font-bold ${n > 0 ? "text-starboard" : "text-slate-300"} ${si === 0 ? "border-l border-slate-200" : ""}`}>{n}</th>;
              }))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAFF.map((st, si) => (
              <tr key={st.n} className="hover:bg-slate-50/40">
                <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-4 py-1.5 text-left text-sm font-semibold text-navy">{st.n}</td>
                {DAYS.map((_, di) => SLOTS.map((_s, shi) => {
                  const status = availState(si, di, shi);
                  const cfg = AVAIL_CELL[status]!;
                  const rostered = ROSTERED.has(`${si}|${di}|${shi}`);
                  return (
                    <td key={`${si}-${di}-${shi}`} className={`p-0 ${shi === 0 ? "border-l border-slate-200" : ""}`}>
                      <button className={`relative flex h-10 w-12 items-center justify-center text-base font-semibold transition ${cfg.cls}`}>
                        <span aria-hidden>{cfg.label}</span>
                        {rostered ? <span className="absolute bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-navy" /> : null}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">The number under each slot is how many instructors are free then. Click a slot to fill an open shift with that instructor.</p>
    </div>
  );
}

// --- Time clock -------------------------------------------------------------

function DemoTimeClock() {
  const rows = [
    { n: "Sarah Whitlock", course: "Start Sailing", in: "08:55", out: null, status: "on-water" as const },
    { n: "Dan Rees", course: "Start Sailing", in: "08:58", out: null, status: "on-water" as const },
    { n: "Megan Foyle", course: "Youth Stage 2", in: "08:52", out: "12:05", status: "done" as const },
    { n: "Tom Bergin", course: "Youth Stage 2", in: "08:50", out: "12:10", status: "done" as const },
    { n: "Priya Nair", course: "Adult Improver (EV)", in: null, out: null, status: "none" as const },
  ];
  const hrs = (a: string | null, b: string | null) => {
    if (!a) return "—";
    const to = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };
    const end = b ? to(b) : to("13:20");
    return ((end - to(a)) / 60).toFixed(1);
  };
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Time clock</h1>
      <p className="mb-6 text-sm text-slate-500">Attendance for 24 Sep 2026 — built from instructor clock-ins.</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-semibold text-navy">On the water now</p><p className="mt-1 text-3xl font-semibold text-starboard">2</p><p className="text-xs text-slate-500">Clocked in, not yet out</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Started today</p><p className="mt-1 text-3xl font-semibold text-navy">4</p><p className="text-xs text-slate-500">Instructors clocked in</p></Card>
        <Card><p className="text-sm font-semibold text-navy">Hours logged today</p><p className="mt-1 text-3xl font-semibold text-navy">6.5</p><p className="text-xs text-slate-500">Actual, from clock times</p></Card>
      </div>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Clock in</th><th className="px-4 py-3">Clock out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.n}>
                <td className="px-4 py-3 font-medium text-navy">{r.n}</td>
                <td className="px-4 py-3 text-slate-600">{r.course}</td>
                <td className="px-4 py-3 text-slate-600">{r.in ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{r.out ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-navy">{hrs(r.in, r.out)}</td>
                <td className="px-4 py-3">
                  {r.status === "none" ? <span className="text-xs text-slate-400">Not started</span> : <StatusPill tone={r.status === "on-water" ? "covered" : "neutral"}>{r.status === "on-water" ? "On the water" : "Signed off"}</StatusPill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Leave & cover ----------------------------------------------------------

function DemoLeave() {
  const leave = [
    { n: "Liam O'Connor", type: "Annual leave", dates: "6–10 Oct", status: "pending" as const },
    { n: "Isla Fraser", type: "Sick", dates: "24 Sep", status: "pending" as const },
    { n: "Freya Donnelly", type: "Training (RYA)", dates: "18–19 Oct", status: "approved" as const },
  ];
  const shifts = [
    { role: "Safety Boat Driver", course: "Powerboat Level 2", when: "Sat 27 Sep · AM", state: "open" as const, by: "" },
    { role: "2nd Instructor", course: "Youth Stage 2", when: "Wed 24 Sep · AM", state: "offered" as const, by: "Grace Hollis" },
    { role: "Windsurf Instructor", course: "Start Windsurf", when: "Sat 27 Sep · PM", state: "filled" as const, by: "Hannah Leung" },
  ];
  const lpill = { pending: "attention", approved: "covered", declined: "conflict" } as const;
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Leave &amp; cover</h1>
      <p className="mb-6 text-sm text-slate-500">Approve leave and fill the gaps it leaves with open shifts staff can claim.</p>

      <h2 className="mb-2 font-semibold text-navy">Leave requests</h2>
      <Card className="mb-8 p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leave.map((l) => (
              <tr key={l.n}>
                <td className="px-4 py-3 font-medium text-navy">{l.n}</td>
                <td className="px-4 py-3 text-slate-600">{l.type}</td>
                <td className="px-4 py-3 text-slate-600">{l.dates}</td>
                <td className="px-4 py-3"><StatusPill tone={lpill[l.status]}>{l.status[0]!.toUpperCase() + l.status.slice(1)}</StatusPill></td>
                <td className="px-4 py-3 text-right">
                  {l.status === "pending" ? (
                    <span className="flex justify-end gap-2">
                      <span className="rounded-lg bg-starboard px-3 py-1.5 text-xs font-semibold text-white">Approve</span>
                      <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy">Decline</span>
                    </span>
                  ) : <span className="text-xs text-slate-400">actioned</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-2 font-semibold text-navy">Open shifts — cover needed</h2>
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {shifts.map((s) => (
            <div key={s.course + s.when} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-navy">{s.role} · {s.course}</p>
                <p className="text-xs text-slate-400">{s.when}</p>
              </div>
              {s.state === "filled" ? <StatusPill tone="covered">Filled · {s.by}</StatusPill>
                : s.state === "offered" ? (
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber">{s.by} offered</span>
                    <span className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Confirm</span>
                  </span>
                ) : <span className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white">Broadcast to available</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- Staff ------------------------------------------------------------------

const STAFF_TABS = [
  { key: "all", label: "All" },
  { key: "fit", label: "Fit to roster" },
  { key: "blocked", label: "Blocked" },
  { key: "expiring", label: "Expiring soon" },
] as const;
type StaffTab = (typeof STAFF_TABS)[number]["key"];

function DemoStaff() {
  const [tab, setTab] = useState<StaffTab>("all");
  const [q, setQ] = useState("");
  const counts = { all: STAFF.length, fit: STAFF.filter((s) => s.fit).length, blocked: STAFF.filter((s) => !s.fit).length, expiring: STAFF.filter((s) => s.warn > 0).length };
  const filtered = useMemo(() => STAFF.filter((r) => {
    if (tab === "fit" && !r.fit) return false;
    if (tab === "blocked" && r.fit) return false;
    if (tab === "expiring" && r.warn === 0) return false;
    if (q.trim() && !`${r.n} ${r.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [tab, q]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Staff</h1>
          <p className="text-sm text-slate-500">{STAFF.length} instructors · fit-to-roster and the courses each can teach, from the qualifications they hold</p>
        </div>
        <span className="flex-none rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">Import from spreadsheet</span>
      </div>

      <Card className="mb-5">
        <h2 className="mb-1 font-semibold text-navy">Add an instructor</h2>
        <p className="mb-3 text-xs text-slate-500">Enter their details and what they teach — we email them an invite to set up their account and upload their licences.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Name</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">Full name</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Email</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">name@centre.co.uk</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Employment</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Employed</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Dinghy Instructor", "Powerboat Instructor", "First Aid", "Safeguarding"].map((c) => (
            <span key={c} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">{c}</span>
          ))}
          <span className="rounded-lg bg-teal px-4 py-1.5 text-xs font-semibold text-white">Add &amp; invite</span>
        </div>
      </Card>

      <div className="rounded-card border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {STAFF_TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${tab === t.key ? "bg-teal text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {t.label}<span className={`ml-1.5 text-xs ${tab === t.key ? "text-white/80" : "text-slate-400"}`}>{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name or email" className="w-64 max-w-[70vw] rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal focus:bg-white" aria-label="Search staff" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {["Name", "Email", "Employment", "Can teach", "Fit to roster", "Portal access"].map((h) => (
                  <th key={h} className="px-4 py-3"><span className="inline-flex items-center gap-1">{h}<ChevronsUpDown className="h-3 w-3 text-slate-300" /></span></th>
                ))}
                <th className="px-4 py-3 text-right"><Settings2 className="ml-auto h-4 w-4 text-slate-300" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No staff match this view.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.n} className="transition hover:bg-navy-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">{r.n.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                      <span className="font-medium text-navy">{r.n}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{r.emp}</td>
                  <td className="px-4 py-3">
                    {r.teaches.length === 0 ? <span className="text-xs text-slate-400">Add a qualification</span> : (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          {r.youth ? <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber">Youth</span> : null}
                          {r.adult ? <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-semibold text-teal">Adult</span> : null}
                        </div>
                        <span className="text-xs text-slate-500">{r.teaches.slice(0, 2).join(", ")}{r.teaches.length > 2 ? ` +${r.teaches.length - 2} more` : ""}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.fit ? <StatusPill tone="covered">Fit</StatusPill> : <StatusPill tone="conflict">{r.block || "Not cleared"}</StatusPill>}
                    {r.warn > 0 ? <span className="ml-2"><StatusPill tone="attention">{r.warn} expiring</StatusPill></span> : null}
                  </td>
                  <td className="px-4 py-3">{r.email ? <span className="text-xs font-semibold text-teal">Invite</span> : <span className="text-xs text-slate-400">Add email to invite</span>}</td>
                  <td className="px-4 py-3 text-right"><Settings2 className="ml-auto h-4 w-4 text-slate-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Equipment --------------------------------------------------------------

function DemoEquipment() {
  const kit = [
    { name: "RIB “Kestrel”", type: "Safety boat", id: "RIB-01", status: "available" },
    { name: "RIB “Merlin”", type: "Safety boat", id: "RIB-02", status: "maintenance" },
    { name: "Pico dinghies ×12", type: "Dinghy", id: "—", status: "available" },
    { name: "ILCA / Laser ×6", type: "Dinghy", id: "—", status: "available" },
    { name: "Topper #4", type: "Dinghy", id: "TOP-04", status: "retired" },
    { name: "Windsurf boards ×10", type: "Windsurf", id: "—", status: "available" },
  ];
  const tone = (s: string) => s === "available" ? "covered" : s === "retired" ? "neutral" : "attention";
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Equipment</h1>
      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Add equipment</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Name</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">e.g. RIB “Falcon”</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Type</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Safety boat</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Identifier</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">optional</div></div>
        </div>
        <span className="mt-3 inline-block rounded-lg bg-teal px-4 py-1.5 text-xs font-semibold text-white">Add equipment</span>
      </Card>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Identifier</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kit.map((e) => (
              <tr key={e.name}>
                <td className="px-4 py-3 font-medium text-navy">{e.name}</td>
                <td className="px-4 py-3 text-slate-600">{e.type}</td>
                <td className="px-4 py-3 text-slate-600">{e.id}</td>
                <td className="px-4 py-3"><StatusPill tone={tone(e.status)}>{e.status}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Locations --------------------------------------------------------------

function DemoLocations() {
  const boxes = [
    { name: "On the water", items: ["Main Harbour", "Estuary Zone", "Open Bay"] },
    { name: "Shore", items: ["Boat Park", "Slipway"] },
    { name: "Indoor", items: ["Training Room", "Changing Rooms"] },
  ];
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Locations</h1>
      <p className="mb-6 text-sm text-slate-500">
        Everywhere activity happens — launch areas, classrooms, pontoons, operating areas. Group them into categories so
        they&apos;re easy to pick when you build a roster.
      </p>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-navy">Add a location</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Name</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">e.g. Main Harbour</div></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Category</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">On the water</div></div>
          </div>
          <span className="mt-3 inline-block rounded-lg bg-teal px-4 py-1.5 text-xs font-semibold text-white">Add location</span>
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Add a category</h2>
          <p className="mb-3 text-xs text-slate-500">Make your own groupings — they appear as boxes below and in the category picker.</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-400">e.g. Off-site</div>
            <span className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white">Add</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box) => (
          <Card key={box.name}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-navy">{box.name}</h3>
              <span className="text-xs text-slate-400">{box.items.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {box.items.map((l) => (
                <li key={l} className="flex items-center justify-between py-2 text-sm text-navy">{l}<span className="text-xs text-slate-300">⋯</span></li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- Payroll (finance) ------------------------------------------------------

type PayRow = { n: string; sched: number; actual: number; rate: string; approved: boolean };
const PAY: PayRow[] = [
  { n: "Sarah Whitlock", sched: 24, actual: 24, rate: "£18.00", approved: true },
  { n: "Tom Bergin", sched: 12, actual: 14, rate: "£16.50", approved: true },
  { n: "Liam O'Connor", sched: 16, actual: 16, rate: "£15.00", approved: true },
  { n: "Priya Nair", sched: 18, actual: 17, rate: "£17.00", approved: false },
  { n: "Megan Foyle", sched: 20, actual: 22, rate: "£18.00", approved: false },
  { n: "Dan Rees", sched: 8, actual: 8, rate: "£16.50", approved: true },
];
const payAmount = (h: number, r: string) => h * parseFloat(r.replace("£", ""));

function DemoFinance() {
  const [openName, setOpenName] = useState<string | null>(null);
  const grand = PAY.reduce((a, p) => a + payAmount(p.actual, p.rate), 0);
  const openRow = PAY.find((p) => p.n === openName) ?? null;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Payroll</h1>
        <span className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy">Export CSV</span>
      </div>

      <Card className="mb-4">
        <p className="text-sm text-slate-500">Total pay (from recorded hours)</p>
        <p className="mt-1 text-3xl font-semibold text-navy">£{grand.toFixed(2)}</p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Scheduled (h)</th><th className="px-4 py-3">Actual (h)</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Pay</th><th className="px-4 py-3">Approved</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PAY.map((p) => (
              <tr key={p.n} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenName(p.n)}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-teal underline decoration-teal/30 underline-offset-2">{p.n}</td>
                <td className="px-4 py-3 text-slate-600">{p.sched.toFixed(2)}</td>
                <td className={`px-4 py-3 ${p.actual !== p.sched ? "font-semibold text-amber" : "text-slate-600"}`}>{p.actual.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-600">{p.rate}</td>
                <td className="px-4 py-3 font-medium text-navy">£{payAmount(p.actual, p.rate).toFixed(2)}</td>
                <td className="px-4 py-3"><StatusPill tone={p.approved ? "covered" : "neutral"}>{p.approved ? "Yes" : "No"}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Actual hours come from session sign-off, so payroll matches what really happened on the water. Click anyone to open their timesheet.</p>

      {openRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onClick={() => setOpenName(null)}>
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-navy">{openRow.n} — timesheet</h3>
                <p className="text-xs text-slate-500">September · {openRow.rate}/h · {openRow.actual} actual hours</p>
              </div>
              <button onClick={() => setOpenName(null)} className="text-sm text-slate-400 hover:text-slate-600">Close ✕</button>
            </div>
            <p className="mt-4 text-sm text-slate-500">Pay this period: <span className="font-semibold text-navy">£{payAmount(openRow.actual, openRow.rate).toFixed(2)}</span></p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Settings ---------------------------------------------------------------

function ConfigBox({ title, items }: { title: string; items: { label: string; meta?: string }[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-navy">{title}</h3>
        <span className="text-xs font-semibold text-teal">+ Add</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-navy">{it.label}{it.meta ? <span className="ml-2 text-xs text-slate-400">{it.meta}</span> : null}</span>
            <span className="h-4 w-7 rounded-full bg-teal/30"><span className="ml-3.5 block h-4 w-3.5 rounded-full bg-teal" /></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DemoSettings() {
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Shape ActivityRoster to how your centre runs — courses, grades, roles, checks and slots are all yours to edit.
        Retiring an item hides it from new records but keeps your history intact (nothing is deleted).
      </p>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold text-navy">General</h2>
        <p className="mb-3 text-xs text-slate-500">Alert lead time controls how early expiring tickets are flagged.</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Session style</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Morning / Afternoon / Evening</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Alert lead (days)</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">30</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Currency</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">GBP</div></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-500">Timezone</label><div className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Europe/London</div></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          {["Enforce licence checks", "Enforce ratio & safety cover", "Enforce double-booking checks"].map((t) => (
            <label key={t} className="flex items-center gap-2"><span className="h-4 w-7 rounded-full bg-teal/30"><span className="ml-3.5 block h-4 w-3.5 rounded-full bg-teal" /></span>{t}</label>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigBox title="Session slots" items={[{ label: "AM · Morning", meta: "09:00–12:30" }, { label: "PM · Afternoon", meta: "13:00–16:30" }, { label: "EV · Evening", meta: "17:30–20:00" }]} />
        <ConfigBox title="Roles" items={[{ label: "Senior Instructor", meta: "ratio" }, { label: "Instructor", meta: "ratio" }, { label: "Safety Boat Driver", meta: "safety" }, { label: "First Aider", meta: "first-aid" }]} />
        <ConfigBox title="Grades" items={[{ label: "Dinghy Instructor", meta: "Sailing" }, { label: "Powerboat Instructor", meta: "Powerboat" }, { label: "Windsurfing Instructor", meta: "Windsurf" }]} />
        <ConfigBox title="Compliance checks" items={[{ label: "First Aid", meta: "mandatory" }, { label: "Safeguarding", meta: "mandatory" }, { label: "DBS / vetting", meta: "mandatory" }]} />
        <ConfigBox title="Equipment types" items={[{ label: "Safety boat", meta: "tracked" }, { label: "Dinghy", meta: "tracked" }, { label: "Buoyancy aids", meta: "bulk" }]} />
        <ConfigBox title="Location types" items={[{ label: "On the water" }, { label: "Shore" }, { label: "Indoor" }]} />
      </div>

      <Card className="mt-8">
        <h2 className="mb-3 font-semibold text-navy">Data &amp; billing</h2>
        <div className="flex flex-wrap gap-3">
          {["Export all data (JSON)", "Manage billing", "Security & 2FA", "Change login PIN"].map((b) => (
            <span key={b} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy">{b}</span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Your data is stored in the EU. Config is deactivate-never-delete: retiring an item keeps historical records intact.</p>
      </Card>
    </div>
  );
}

// --- Billing ----------------------------------------------------------------

function DemoBilling() {
  const invoices = [
    { num: "INV-2026-009", date: "1 Sep 2026", amount: "£65.00", status: "paid" },
    { num: "INV-2026-008", date: "1 Aug 2026", amount: "£65.00", status: "paid" },
    { num: "INV-2026-007", date: "1 Jul 2026", amount: "£65.00", status: "paid" },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Billing</h1>
      <p className="mb-5 text-sm text-slate-500">Your plan, payments and VAT invoices.</p>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">Current status</p>
            <p className="mt-0.5 text-lg font-semibold capitalize text-navy">active · Standard £65/mo</p>
          </div>
          <StatusPill tone="covered">Active</StatusPill>
        </div>
        <span className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy">Manage billing, card &amp; cancellation →</span>
      </Card>

      <Card className="mb-6 border-amber/40 bg-amber/5">
        <h2 className="mb-2 font-semibold text-navy">Done-for-you setup</h2>
        <p className="text-sm text-slate-600">We build the platform around exactly how your centre runs — from £850, plus £350 travel for on-site work with your team. One-off; then you continue on the normal plan.</p>
      </Card>

      <Card className="p-0">
        <h2 className="px-4 pt-4 font-semibold text-navy">Invoices</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">PDF</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.num}>
                <td className="px-4 py-3 font-medium text-navy">{i.num}</td>
                <td className="px-4 py-3 text-slate-600">{i.date}</td>
                <td className="px-4 py-3 text-slate-600">{i.amount}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{i.status}</td>
                <td className="px-4 py-3 text-right"><span className="font-semibold text-teal">Download</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Course setup -----------------------------------------------------------

function DemoCourseSetup() {
  const types = [
    { n: "RYA Start Sailing", scheme: "National Sailing", cap: 8, ratio: 6, safety: false },
    { n: "RYA Youth Stage 2", scheme: "Youth Sailing", cap: 12, ratio: 6, safety: true },
    { n: "RYA Powerboat Level 2", scheme: "Powerboat", cap: 6, ratio: 3, safety: true },
    { n: "RYA Start Windsurfing", scheme: "Windsurfing", cap: 10, ratio: 6, safety: false },
  ];
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Course setup</h1>
      <p className="mb-4 text-sm text-slate-500">Your RYA course-type catalogue. Editing defaults and add/remove lands with full course management.</p>
      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Course type</th><th className="px-4 py-3">Scheme</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Ratio</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((c) => (
              <tr key={c.n}>
                <td className="px-4 py-3 font-medium text-navy">{c.n}</td>
                <td className="px-4 py-3 text-slate-600">{c.scheme}</td>
                <td className="px-4 py-3 text-slate-600">{c.cap}</td>
                <td className="px-4 py-3 text-slate-600">1:{c.ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- Change log -------------------------------------------------------------

function DemoChangeLog() {
  const rows = [
    { when: "Today · 13:22", who: "Sarah Whitlock", what: "Assigned Dan Rees (Safety Boat) to Powerboat L2 · Sat" },
    { when: "Today · 11:05", who: "Sarah Whitlock", what: "Approved annual leave — Liam O'Connor, 6–10 Oct" },
    { when: "Yesterday · 16:40", who: "Megan Foyle", what: "Added instructor — Grace Hollis (Assistant)" },
    { when: "Yesterday · 09:12", who: "System", what: "Flagged ticket expiring — Tom Bergin, Safeguarding (12 Oct)" },
    { when: "27 Sep · 14:30", who: "Sarah Whitlock", what: "Marked Topper #4 out of action" },
    { when: "26 Sep · 10:02", who: "Sarah Whitlock", what: "Updated pay rate — Chloe Adeyemi (£18.00/h)" },
  ];
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Change log</h1>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.when + r.what} className="flex gap-3 px-4 py-3">
              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-teal" />
              <div>
                <p className="text-sm text-navy">{r.what}</p>
                <p className="text-xs text-slate-400">{r.who} · {r.when}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-2 text-xs text-slate-400">Every roster, staff, resource and billing change is recorded — scoped to your centre, and exportable.</p>
    </div>
  );
}

// --- Integrations -----------------------------------------------------------

function DemoIntegrations({ onBack }: { onBack: () => void }) {
  const feeds = [
    { n: "Bookwhen", kind: "Booking system", status: "connected" as const, last: "synced 8 min ago", courses: 18 },
    { n: "WebCollect", kind: "Membership & bookings", status: "connected" as const, last: "synced 1 h ago", courses: 24 },
    { n: "Google Calendar", kind: "Calendar (ICS)", status: "connected" as const, last: "synced 20 min ago", courses: 6 },
    { n: "Class4Kids", kind: "Booking system", status: "available" as const, last: "not connected", courses: 0 },
    { n: "Any other calendar (ICS)", kind: "Paste a feed URL", status: "available" as const, last: "not connected", courses: 0 },
  ];
  const tone = { connected: "covered", available: "neutral" } as const;
  return (
    <div>
      <button onClick={onBack} className="mb-2 text-xs text-slate-400 hover:text-slate-600">← Courses</button>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Integrations</h1>
      <p className="mb-6 text-sm text-slate-500">Pull your courses in automatically from the booking system or calendar you already use — one-way and read-only.</p>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Courses imported</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feeds.map((f) => (
              <tr key={f.n}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{f.n}</td>
                <td className="px-4 py-3 text-slate-600">{f.kind}</td>
                <td className="px-4 py-3 text-slate-600">{f.courses || "—"}</td>
                <td className="px-4 py-3"><StatusPill tone={tone[f.status]}>{f.status === "connected" ? "Connected" : "Available"}</StatusPill><span className="block text-xs text-slate-400">{f.last}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">We never change anything in your booking system — we only read the course calendar and turn each event into a draft session for you to review.</p>
    </div>
  );
}

// --- Instructor portal ------------------------------------------------------

type Avail = "free" | "maybe" | "busy" | "none";
function DemoPortal() {
  const initial: Record<string, Avail> = {
    "Mon|AM": "free", "Mon|PM": "busy", "Mon|EV": "none",
    "Tue|AM": "free", "Tue|PM": "free", "Tue|EV": "maybe",
    "Wed|AM": "free", "Wed|PM": "none", "Wed|EV": "free",
  };
  const [avail, setAvail] = useState(initial);
  const cycle: Avail[] = ["free", "maybe", "busy", "none"];
  const label: Record<Avail, string> = { free: "Free", maybe: "Maybe", busy: "Busy", none: "—" };
  const tone: Record<Avail, string> = { free: "bg-starboard/15 text-starboard", maybe: "bg-amber/15 text-amber", busy: "bg-port/15 text-port", none: "bg-slate-100 text-slate-400" };
  const tap = (k: string) => setAvail((a) => ({ ...a, [k]: cycle[(cycle.indexOf(a[k] ?? "none") + 1) % cycle.length]! }));

  return (
    <div className="flex justify-center py-6">
      <div className="w-[340px] max-w-full overflow-hidden rounded-[30px] border-[10px] border-[#0b1620] shadow-2xl">
        <div className="bg-navy px-4 py-4 text-white">
          <Logo variant="onDark" size="sm" />
          <p className="mt-1 text-xs text-white/70">Harbour Sailing Centre · Sarah Whitlock</p>
        </div>
        <div className="min-h-[380px] bg-canvas p-4">
          <p className="mb-2 font-display text-lg font-semibold text-navy">My schedule</p>
          {[
            { c: "Start Sailing", t: "Mon 22 Sep · 09:00–12:30", s: "AM" },
            { c: "Improving Skills", t: "Tue 23 Sep · 13:00–16:30", s: "PM" },
            { c: "Adult Improver", t: "Wed 24 Sep · 17:30–20:00", s: "EV" },
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
              {SLOTS.map((s) => {
                const k = `${d}|${s}`;
                const v = avail[k] ?? "none";
                return (
                  <button key={k} onClick={() => tap(k)} className={`rounded-lg py-2 text-xs font-semibold ${tone[v]}`}>
                    <span className="block text-[10px] uppercase opacity-70">{s}</span>{label[v]}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="mt-1.5 text-center text-[11px] text-slate-400">Tap to cycle: Free → Maybe → Busy → clear</p>
        </div>
        <div className="flex justify-around border-t border-slate-200 bg-white py-2.5 text-[10px] text-slate-400">
          {["Schedule", "Available", "Clock", "Leave", "Hours", "Docs"].map((t, i) => (
            <span key={t} className={i === 0 ? "font-semibold text-teal" : ""}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
