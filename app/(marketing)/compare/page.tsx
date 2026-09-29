import Link from "next/link";
import { Check, Minus, X } from "lucide-react";

export const metadata = {
  title: "ActivityRoster vs the alternatives",
  description:
    "How ActivityRoster compares with general staff-rostering apps, club/membership systems and spreadsheets for RYA sailing and watersports centres.",
};

type Cell = "yes" | "partial" | "no";

interface Row {
  feature: string;
  detail: string;
  us: Cell;
  general: Cell;
  club: Cell;
  sheets: Cell;
}

const COLUMNS = [
  { key: "us", label: "ActivityRoster", sub: "RYA-built" },
  { key: "general", label: "General rostering apps", sub: "Deputy · When I Work · RotaCloud · Planday" },
  { key: "club", label: "Club / membership systems", sub: "WebCollect · Membermojo · club CRMs" },
  { key: "sheets", label: "Spreadsheets", sub: "Excel · Google Sheets" },
] as const;

const ROWS: Row[] = [
  {
    feature: "RYA ratio & safety-boat cover checks",
    detail: "Flags an understaffed session or missing safety cover as you roster — not after.",
    us: "yes", general: "no", club: "no", sheets: "no",
  },
  {
    feature: "Instructor licence & ticket tracking",
    detail: "Dinghy/keelboat/windsurf/SUP/powerboat tickets, first aid, with expiry alerts.",
    us: "yes", general: "partial", club: "partial", sheets: "partial",
  },
  {
    feature: "Blocks unqualified / expired staff",
    detail: "Can't be rostered onto a course they're not cleared for (admin override recorded).",
    us: "yes", general: "no", club: "no", sheets: "no",
  },
  {
    feature: "Youth vs adult courses kept separate",
    detail: "Every course is labelled and colour-coded throughout the platform.",
    us: "yes", general: "no", club: "no", sheets: "partial",
  },
  {
    feature: "DBS / safeguarding vetting register",
    detail: "Mandatory checks tracked per instructor and enforced at assignment.",
    us: "yes", general: "no", club: "partial", sheets: "partial",
  },
  {
    feature: "Course-based scheduling (multi-session)",
    detail: "A 5-day camp or a weekly club as one course with many sessions across days/times.",
    us: "yes", general: "partial", club: "no", sheets: "partial",
  },
  {
    feature: "Visual week calendar + drag-free planner",
    detail: "Google-Calendar-style week view; click a day to add a session.",
    us: "yes", general: "yes", club: "no", sheets: "no",
  },
  {
    feature: "Bulk assign one instructor to many courses",
    detail: "Roster a person across a run of courses in one pass, with the same safety checks.",
    us: "yes", general: "partial", club: "no", sheets: "partial",
  },
  {
    feature: "Instructor availability collection",
    detail: "Staff submit availability from their own app; office sees free/maybe/busy per slot.",
    us: "yes", general: "yes", club: "no", sheets: "no",
  },
  {
    feature: "Clock in/out & payroll-ready hours",
    detail: "Time & attendance with automatic timesheets and an export for payroll.",
    us: "yes", general: "yes", club: "no", sheets: "no",
  },
  {
    feature: "Printable weekly rota (PDF)",
    detail: "Clean rota — who's on, where, when — to print or share.",
    us: "yes", general: "partial", club: "no", sheets: "yes",
  },
  {
    feature: "Import existing courses",
    detail: "Bring your courses in from a spreadsheet or calendar with an assisted review.",
    us: "yes", general: "partial", club: "no", sheets: "yes",
  },
  {
    feature: "Equipment & boat tracking",
    detail: "Boats, yachts, engines and kit tracked and conflict-checked against sessions.",
    us: "yes", general: "no", club: "no", sheets: "partial",
  },
  {
    feature: "Per-centre data isolation (multi-site safe)",
    detail: "Each centre's data is structurally separated — never mixed with another's.",
    us: "yes", general: "partial", club: "partial", sheets: "no",
  },
  {
    feature: "EU-hosted, GDPR-ready, export any time",
    detail: "Data pinned to the EU with PII scrubbing and a full export on demand.",
    us: "yes", general: "partial", club: "partial", sheets: "no",
  },
  {
    feature: "Built for RYA centres out of the box",
    detail: "RYA schemes, grades, ratios and defaults seeded on day one — no configuration marathon.",
    us: "yes", general: "no", club: "no", sheets: "no",
  },
];

const ICON: Record<Cell, React.ReactNode> = {
  yes: <Check className="mx-auto h-5 w-5 text-starboard" aria-label="Yes" />,
  partial: <Minus className="mx-auto h-5 w-5 text-amber" aria-label="Partial" />,
  no: <X className="mx-auto h-5 w-5 text-slate-300" aria-label="No" />,
};

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Compare</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">Why centres pick ActivityRoster</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          General rostering apps schedule shifts. Club systems take bookings and money. Spreadsheets do
          whatever you build. None of them understand an RYA centre&apos;s compliance the way ActivityRoster does —
          ratios, safety cover, tickets and vetting, enforced as you roster.
        </p>
      </div>

      {/* Positioning cards */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { h: "vs general rostering apps", p: "They roster any workforce well, but don't know a Level 2 from a Senior Instructor, a safety-boat ratio, or an expired first-aid ticket. You'd bolt compliance on by hand — the exact thing that goes wrong." },
          { h: "vs club / membership systems", p: "Great at members, subs and public bookings. Staff rostering, qualifications and safety cover are an afterthought, if they're there at all." },
          { h: "vs spreadsheets", p: "Free and flexible until a tab breaks, an expiry is missed, or two instructors get double-booked. No alerts, no audit trail, no isolation between sites." },
        ].map((c) => (
          <div key={c.h} className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-navy">{c.h}</h2>
            <p className="mt-2 text-sm text-slate-600">{c.p}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="mt-12 overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="p-4 text-left align-bottom">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capability</span>
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={`p-4 text-center align-bottom ${c.key === "us" ? "bg-teal/5" : ""}`}>
                  <span className={`block font-display text-sm font-bold ${c.key === "us" ? "text-teal" : "text-navy"}`}>{c.label}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{c.sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map((r) => (
              <tr key={r.feature} className="hover:bg-slate-50/60">
                <th scope="row" className="p-4 text-left font-normal">
                  <span className="block font-semibold text-navy">{r.feature}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{r.detail}</span>
                </th>
                <td className="p-4 text-center align-middle bg-teal/5">{ICON[r.us]}</td>
                <td className="p-4 text-center align-middle">{ICON[r.general]}</td>
                <td className="p-4 text-center align-middle">{ICON[r.club]}</td>
                <td className="p-4 text-center align-middle">{ICON[r.sheets]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-starboard" /> Built in</span>
        <span className="inline-flex items-center gap-1"><Minus className="h-4 w-4 text-amber" /> Partial / add-on / manual</span>
        <span className="inline-flex items-center gap-1"><X className="h-4 w-4 text-slate-300" /> Not really</span>
        <span className="ml-auto">Comparison reflects typical offerings; check each vendor for their current features.</span>
      </div>

      {/* CTA */}
      <div className="mt-14 rounded-card border border-teal bg-navy p-8 text-center text-white">
        <h2 className="font-display text-2xl font-bold">See it with your own courses</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
          Start a free month — no card required. Import your existing courses in minutes and roster your first
          week with the safety checks already switched on.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/#get-demo" className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-700">Start my free month</a>
          <Link href="/learn" className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">Explore the Learning Centre</Link>
        </div>
      </div>
    </div>
  );
}
