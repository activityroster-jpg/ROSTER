/**
 * Static, print-safe renderings of the real platform screens, personalised for
 * a prospect. These mirror the live office/portal markup (same colours,
 * sidebar, cards, pills) but are plain server components with sample data —
 * nothing here is interactive or reads a database.
 */
import {
  CalendarDays, CalendarOff, ClipboardList, Clock, CreditCard, History, LayoutDashboard, LifeBuoy, MapPin, Settings, Ship, Users, Wallet,
} from "lucide-react";

export interface SampleData {
  centre: string;
  slug: string;
  weekLabel: string;
  days: { label: string; date: string }[];
  staff: { name: string; role: string; fit: "fit" | "blocked" | "expiring"; note: string; teaches: string }[];
  sessions: { day: number; slot: "AM" | "PM" | "EV"; start: string; end: string; course: string; audience: "youth" | "adult"; staff: { name: string; role: string }[]; location: string; equipment: string; cover: "covered" | "needs" | "nosafety" }[];
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 24) || "yourcentre";
}

/** Next Monday from `now`, as the sample week. */
export function sampleData(centre: string, now = new Date()): SampleData {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d.getTime() + i * 86_400_000);
    return { label: x.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }), date: x.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) };
  });
  const weekLabel = `${days[0]!.date} – ${days[6]!.date}`;
  const sam = { name: "Sam Green", role: "Senior Instructor" };
  const priya = { name: "Priya Nair", role: "Instructor" };
  const tom = { name: "Tom Walsh", role: "Instructor" };
  const ellie = { name: "Ellie Morgan", role: "Assistant Instructor" };
  const jack = { name: "Jack O'Neill", role: "Safety Boat Driver" };
  const hannah = { name: "Hannah Reid", role: "Volunteer" };
  return {
    centre,
    slug: slugify(centre),
    weekLabel,
    days,
    staff: [
      { name: sam.name, role: "Dinghy Senior Instructor", fit: "fit", note: "All checks current", teaches: "Youth Stage 1–4, Level 1–2" },
      { name: priya.name, role: "Dinghy Instructor", fit: "fit", note: "All checks current", teaches: "Youth Stage 1–3, Level 1" },
      { name: tom.name, role: "Dinghy Instructor", fit: "expiring", note: "First aid expires in 21 days", teaches: "Level 1–2, Day Sailing" },
      { name: ellie.name, role: "Assistant Instructor", fit: "fit", note: "All checks current", teaches: "Youth Stage 1–2" },
      { name: jack.name, role: "Powerboat Instructor", fit: "fit", note: "Safety Boat Certificate", teaches: "Powerboat Level 2" },
      { name: hannah.name, role: "Volunteer", fit: "blocked", note: "DBS check missing", teaches: "—" },
    ],
    sessions: [
      { day: 0, slot: "AM", start: "09:30", end: "12:30", course: "Youth Stage 1", audience: "youth", staff: [priya, ellie, jack], location: "Main lake", equipment: "Pico ×4 · Safety RIB 1", cover: "covered" },
      { day: 0, slot: "PM", start: "13:30", end: "16:30", course: "Start Sailing (Level 1)", audience: "adult", staff: [sam, jack], location: "Main lake", equipment: "Wayfarer ×2 · Safety RIB 1", cover: "covered" },
      { day: 1, slot: "AM", start: "09:30", end: "12:30", course: "Youth Stage 2", audience: "youth", staff: [priya], location: "Main lake", equipment: "Pico ×4", cover: "nosafety" },
      { day: 2, slot: "EV", start: "18:00", end: "20:30", course: "Junior Club Session", audience: "youth", staff: [sam, ellie, jack], location: "Main lake", equipment: "Pico ×6 · Safety RIB 1", cover: "covered" },
      { day: 3, slot: "AM", start: "09:30", end: "16:30", course: "Powerboat Level 2", audience: "adult", staff: [jack], location: "Slipway", equipment: "Safety RIB 2", cover: "covered" },
      { day: 4, slot: "AM", start: "09:30", end: "12:30", course: "Basic Skills (Level 2)", audience: "adult", staff: [tom], location: "Main lake", equipment: "Wayfarer ×2", cover: "needs" },
      { day: 5, slot: "AM", start: "09:00", end: "17:00", course: "Youth Stage 3", audience: "youth", staff: [sam, priya, jack], location: "Main lake", equipment: "Laser ×6 · Safety RIB 1", cover: "covered" },
      { day: 5, slot: "PM", start: "13:00", end: "16:00", course: "Start Sailing (Level 1)", audience: "adult", staff: [tom, jack], location: "Main lake", equipment: "Wayfarer ×2 · Safety RIB 2", cover: "covered" },
      { day: 6, slot: "AM", start: "10:00", end: "13:00", course: "Youth Stage 1", audience: "youth", staff: [priya, ellie, jack], location: "Main lake", equipment: "Pico ×4 · Safety RIB 1", cover: "covered" },
    ],
  };
}

/* ---------- Frames ---------- */

export function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5">
        <span className="flex gap-1"><i className="h-2 w-2 rounded-full bg-[#ff5f57]" /><i className="h-2 w-2 rounded-full bg-[#febc2e]" /><i className="h-2 w-2 rounded-full bg-[#28c840]" /></span>
        <span className="ml-2 flex-1 rounded-md bg-white px-2 py-0.5 text-[9px] text-slate-500">🔒 {url}</span>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[64mm] overflow-hidden rounded-[1.6rem] border-[5px] border-slate-800 bg-white shadow-md">
      <div className="flex justify-center bg-slate-800 py-1"><span className="h-1.5 w-12 rounded-full bg-slate-600" /></div>
      {children}
    </div>
  );
}

const NAV = [
  { group: "Operate", items: [["Dashboard", LayoutDashboard], ["Courses", CalendarDays], ["Availability", ClipboardList], ["Time clock", Clock], ["Leave & cover", CalendarOff]] },
  { group: "Resources", items: [["Staff", Users], ["Equipment", Ship], ["Locations", MapPin], ["Payroll", Wallet]] },
  { group: "Configure", items: [["Settings", Settings], ["Billing", CreditCard], ["Course setup", LifeBuoy], ["Change log", History]] },
] as const;

/** The office shell: navy sidebar with the real nav, content on the canvas. */
export function OfficeShell({ centre, active, children }: { centre: string; active: string; children: React.ReactNode }) {
  return (
    <div className="flex bg-canvas text-[8px]" style={{ minHeight: "118mm" }}>
      <aside className="w-[34mm] flex-none bg-navy p-2.5 text-white">
        <p className="font-display text-[10px] font-bold">⛵ ActivityRoster</p>
        <p className="mb-2 truncate text-[7px] text-white/70">{centre}</p>
        {NAV.map((s) => (
          <div key={s.group} className="mb-2">
            <p className="mb-0.5 text-[6px] font-semibold uppercase tracking-wide text-white/40">{s.group}</p>
            {s.items.map(([label, Icon]) => (
              <div key={label} className={`flex items-center gap-1.5 rounded px-1.5 py-[3px] ${label === active ? "bg-white/15 text-white" : "text-white/75"}`}>
                <Icon className="h-2.5 w-2.5" />{label}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div className="flex-1 p-3">{children}</div>
    </div>
  );
}

const Pill = ({ tone, children }: { tone: "covered" | "attention" | "conflict" | "neutral"; children: React.ReactNode }) => (
  <span className={`inline-block rounded-full px-1.5 py-[1px] text-[6.5px] font-semibold ${tone === "covered" ? "bg-starboard/15 text-starboard" : tone === "attention" ? "bg-amber/15 text-amber" : tone === "conflict" ? "bg-port/15 text-port" : "bg-slate-100 text-slate-500"}`}>{children}</span>
);
const Aud = ({ a }: { a: "youth" | "adult" }) => <span className={`rounded px-1 py-[1px] text-[6px] font-semibold ${a === "youth" ? "bg-amber/15 text-amber" : "bg-teal/15 text-teal"}`}>{a === "youth" ? "Youth" : "Adult"}</span>;
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-lg border border-slate-200 bg-white p-2.5 ${className}`}>{children}</div>;
const coverPill = (c: SampleData["sessions"][number]["cover"]) => c === "covered" ? <Pill tone="covered">Covered</Pill> : c === "needs" ? <Pill tone="attention">Under-staffed</Pill> : <Pill tone="conflict">No safety cover</Pill>;

/* ---------- Screens ---------- */

export function DashboardScreen({ d }: { d: SampleData }) {
  const today = d.sessions.filter((s) => s.day === 0);
  return (
    <OfficeShell centre={d.centre} active="Dashboard">
      <h1 className="font-display text-[12px] font-semibold text-navy">Good morning — {d.days[0]!.label} {d.days[0]!.date}</h1>
      <p className="mb-2 text-[7px] text-slate-500">{d.centre} · week of {d.weekLabel}</p>
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {[["Sessions this week", String(d.sessions.length), "View / print rota"], ["Staff fit to roster", "4 of 6", "1 expiring · 1 blocked"], ["Needs cover", "2", "1 under-staffed · 1 no safety boat"], ["Hours this week", "68.5", "£1,712 est. pay"]].map(([l, v, s]) => (
          <Card key={l}><p className="text-[6.5px] font-semibold text-navy">{l}</p><p className="text-[13px] font-semibold text-navy">{v}</p><p className="text-[6px] text-slate-400">{s}</p></Card>
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-1.5">
        <Card>
          <p className="mb-1 font-semibold text-navy">Today</p>
          {today.map((s) => (
            <div key={s.course} className="mb-1 flex items-center justify-between rounded border border-slate-100 px-1.5 py-1">
              <div><span className="font-semibold text-navy">{s.start}–{s.end}</span> <Aud a={s.audience} /> <span>{s.course}</span><p className="text-[6.5px] text-slate-500">{s.staff.map((x) => x.name).join(", ")} · {s.location}</p></div>
              {coverPill(s.cover)}
            </div>
          ))}
          <p className="mt-1 text-[6.5px] font-semibold text-teal">Open the week calendar →</p>
        </Card>
        <Card>
          <p className="mb-1 font-semibold text-navy">Needs your attention</p>
          <ul className="space-y-1">
            <li className="rounded bg-port/5 px-1.5 py-1"><span className="font-semibold text-port">No safety cover</span> — Youth Stage 2, {d.days[1]!.label} AM</li>
            <li className="rounded bg-amber/5 px-1.5 py-1"><span className="font-semibold text-amber">Under-staffed</span> — Basic Skills (L2), {d.days[4]!.label} AM: 1 of 2</li>
            <li className="rounded bg-amber/5 px-1.5 py-1"><span className="font-semibold text-amber">Expiring</span> — Tom Walsh, First Aid (21 days)</li>
            <li className="rounded bg-port/5 px-1.5 py-1"><span className="font-semibold text-port">Blocked</span> — Hannah Reid, DBS missing</li>
            <li className="rounded bg-slate-50 px-1.5 py-1"><span className="font-semibold text-navy">Leave request</span> — Priya Nair, 2 days next month</li>
          </ul>
        </Card>
      </div>
    </OfficeShell>
  );
}

export function CoursesScreen({ d }: { d: SampleData }) {
  return (
    <OfficeShell centre={d.centre} active="Courses">
      <div className="mb-1.5 flex items-center justify-between">
        <h1 className="font-display text-[12px] font-semibold text-navy">Courses</h1>
        <div className="flex gap-1 text-[6.5px]"><span className="rounded border border-slate-300 px-1.5 py-0.5 text-navy">Import</span><span className="rounded border border-slate-300 px-1.5 py-0.5 text-navy">Check booking system</span><span className="rounded bg-teal px-1.5 py-0.5 font-semibold text-white">Add a course</span></div>
      </div>
      <Card className="mb-1.5">
        <div className="mb-1 flex items-center gap-1 text-[7px]"><span className="font-semibold text-navy">Calendar</span><span className="rounded bg-navy px-1.5 py-0.5 text-white">{d.weekLabel} · next week</span></div>
        <div className="grid grid-cols-7 gap-1">
          {d.days.map((day, i) => (
            <div key={i} className="min-h-[22mm] rounded border border-slate-100 bg-slate-50/50 p-1">
              <p className="text-center text-[6px] font-semibold uppercase text-slate-400">{day.label}</p>
              <p className="mb-1 text-center text-[8px] font-bold text-navy">{day.date.split(" ")[0]}</p>
              {d.sessions.filter((s) => s.day === i).map((s) => (
                <div key={s.course + s.slot} className={`mb-0.5 rounded border-l-2 px-1 py-0.5 text-[6px] leading-tight ${s.audience === "youth" ? "border-l-amber bg-amber/15 text-amber" : "border-l-teal bg-teal/15 text-teal"}`}>
                  <span className="block font-semibold">{s.start}</span><span className="block truncate">{s.course}</span>
                </div>
              ))}
              <p className="mt-0.5 rounded border border-teal/40 bg-teal/5 text-center text-[5.5px] font-semibold text-teal">＋ Add</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-1">
        {d.sessions.slice(0, 4).map((s, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 ${i % 2 ? "bg-sky-100/70" : "bg-white"}`}>
            <span className="text-slate-400">▸</span><Aud a={s.audience} />
            <span className="font-semibold text-navy">{s.course}</span>
            <span className="text-slate-500">{d.days[s.day]!.label} {d.days[s.day]!.date}, {s.start}–{s.end}</span>
            <span className="rounded bg-slate-100 px-1 text-[6px] text-slate-600">Instructor {s.staff.filter((x) => x.role.includes("Instructor")).length}/2</span>
            <span className="rounded bg-slate-100 px-1 text-[6px] text-slate-600">Safety Boat {s.staff.some((x) => x.role.includes("Safety")) ? 1 : 0}/1</span>
            <span className="ml-auto">{coverPill(s.cover)}</span>
            <span className="text-[6.5px] font-medium text-teal">manage →</span>
          </div>
        ))}
      </div>
    </OfficeShell>
  );
}

export function StaffScreen({ d }: { d: SampleData }) {
  return (
    <OfficeShell centre={d.centre} active="Staff">
      <div className="mb-1.5 flex items-center justify-between">
        <h1 className="font-display text-[12px] font-semibold text-navy">Staff</h1>
        <div className="flex gap-1 text-[6.5px]"><span className="rounded border border-slate-300 px-1.5 py-0.5 text-navy">Import from spreadsheet</span><span className="rounded bg-teal px-1.5 py-0.5 font-semibold text-white">Add instructor</span></div>
      </div>
      <div className="mb-1.5 flex gap-1 text-[6.5px]">{["All (6)", "Fit (4)", "Blocked (1)", "Expiring (1)"].map((t, i) => <span key={t} className={`rounded px-1.5 py-0.5 ${i === 0 ? "bg-navy text-white" : "border border-slate-300 text-navy"}`}>{t}</span>)}</div>
      <Card className="p-0">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[6px] uppercase tracking-wide text-slate-500"><tr>{["Name", "Grade", "Can teach", "Status", "Portal"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {d.staff.map((s) => (
              <tr key={s.name}>
                <td className="px-2 py-1 font-semibold text-navy">{s.name}</td>
                <td className="px-2 py-1 text-slate-600">{s.role}</td>
                <td className="px-2 py-1 text-slate-600">{s.teaches}</td>
                <td className="px-2 py-1">{s.fit === "fit" ? <Pill tone="covered">Fit</Pill> : s.fit === "expiring" ? <><Pill tone="covered">Fit</Pill> <Pill tone="attention">{s.note}</Pill></> : <Pill tone="conflict">{s.note}</Pill>}</td>
                <td className="px-2 py-1"><Pill tone={s.fit === "blocked" ? "attention" : "covered"}>{s.fit === "blocked" ? "Invite pending" : "Portal access"}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-1.5 text-[6.5px] text-slate-500">Each instructor uploads their own licences from their phone; you verify with one click. Expiry alerts arrive 30 days out.</p>
    </OfficeShell>
  );
}

export function PayrollScreen({ d }: { d: SampleData }) {
  const rows = [["Sam Green", 4, "21.0", "1.0", "20.0", "£560.00"], ["Priya Nair", 4, "15.5", "0.5", "15.0", "£375.00"], ["Tom Walsh", 2, "6.0", "0.0", "6.0", "£150.00"], ["Ellie Morgan", 3, "8.5", "0.0", "8.5", "£170.00"], ["Jack O'Neill", 7, "26.0", "1.5", "24.5", "£612.50"]];
  return (
    <OfficeShell centre={d.centre} active="Payroll">
      <div className="mb-1.5 flex items-center justify-between">
        <h1 className="font-display text-[12px] font-semibold text-navy">Payroll</h1>
        <div className="flex gap-1 text-[6.5px]"><span className="rounded border border-slate-300 px-1.5 py-0.5 text-navy">Spreadsheet · every shift</span><span className="rounded border border-slate-300 px-1.5 py-0.5 text-navy">Spreadsheet · totals</span><span className="rounded bg-teal px-1.5 py-0.5 font-semibold text-white">PDF</span></div>
      </div>
      <Card className="mb-1.5 flex items-end gap-2 text-[6.5px]"><span>Period <b className="rounded border border-slate-300 px-1">This week</b></span><span>Instructor <b className="rounded border border-slate-300 px-1">Everyone</b></span><span className="rounded bg-navy px-1.5 py-0.5 font-semibold text-white">Show</span></Card>
      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        <Card><p className="text-[6.5px] text-slate-500">Total pay</p><p className="text-[12px] font-semibold text-navy">£1,867.50</p></Card>
        <Card><p className="text-[6.5px] text-slate-500">Paid hours</p><p className="text-[12px] font-semibold text-navy">74.0</p></Card>
        <Card><p className="text-[6.5px] text-slate-500">Lunch breaks</p><p className="text-[8px] text-navy">30 min unpaid after 6 h</p></Card>
      </div>
      <Card className="p-0">
        <table className="w-full text-left">
          <thead className="text-[6px] uppercase tracking-wide text-slate-500"><tr>{["Instructor", "Shifts", "Worked (h)", "Lunch (h)", "Paid (h)", "Pay"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((r) => <tr key={String(r[0])}>{r.map((c, i) => <td key={i} className={`px-2 py-1 ${i === 0 ? "font-semibold text-navy" : "text-slate-600"}`}>{c}</td>)}</tr>)}</tbody>
        </table>
      </Card>
      <p className="mt-1.5 text-[6.5px] text-slate-500">Start and finish come from clock-in/out where there is one, otherwise from the schedule. Downloads open in Excel or Google Sheets.</p>
    </OfficeShell>
  );
}

export function InstructorAppScreen({ d }: { d: SampleData }) {
  const mine = d.sessions.filter((s) => s.staff.some((x) => x.name === "Priya Nair")).slice(0, 3);
  return (
    <PhoneFrame>
      <div className="bg-navy px-3 py-2 text-white"><p className="text-[7px] text-white/70">{d.centre}</p><p className="font-display text-[10px] font-bold">Hi Priya 👋</p></div>
      <div className="space-y-1.5 bg-canvas p-2 text-[7px]">
        <div className="rounded-lg bg-teal p-2 text-white"><p className="text-[6.5px] text-white/80">Next up · {d.days[0]!.label} 09:30</p><p className="font-semibold">Youth Stage 1 · Main lake</p><p className="mt-1 inline-block rounded bg-white px-2 py-0.5 text-[6.5px] font-semibold text-teal">Clock in</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="mb-1 font-semibold text-navy">My week</p>{mine.map((s) => <p key={s.course + s.day} className="flex justify-between"><span>{d.days[s.day]!.label} {s.start}</span><span className="text-slate-500">{s.course}</span></p>)}</div>
        <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="mb-1 font-semibold text-navy">Availability · next week</p><div className="grid grid-cols-7 gap-0.5">{["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <span key={i} className={`rounded py-0.5 text-center text-[6px] font-semibold ${i === 2 || i === 4 ? "bg-slate-200 text-slate-500" : "bg-starboard/15 text-starboard"}`}>{x}</span>)}</div></div>
        <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="mb-1 font-semibold text-navy">My documents</p><p className="flex justify-between"><span>Dinghy Instructor</span><span className="text-starboard">✓ verified</span></p><p className="flex justify-between"><span>First Aid</span><span className="text-starboard">✓ to Mar 2027</span></p><p className="flex justify-between"><span>DBS</span><span className="text-starboard">✓ verified</span></p></div>
        <div className="rounded-lg border border-amber/40 bg-amber/5 p-2"><p className="font-semibold text-navy">Open shift</p><p className="text-slate-600">Basic Skills (L2) · {d.days[4]!.label} AM · <span className="font-semibold text-teal">Claim</span></p></div>
      </div>
    </PhoneFrame>
  );
}

/** The printable "By week" rota, as the Rota page prints it. */
export function WeekRota({ d }: { d: SampleData }) {
  return (
    <div className="space-y-2 text-[8px]">
      {d.days.map((day, i) => {
        const ses = d.sessions.filter((s) => s.day === i);
        return (
          <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-2 py-1 font-semibold text-navy">{day.label} {day.date}</div>
            {ses.length === 0 ? <p className="px-2 py-1 text-slate-400">No sessions.</p> : (
              <table className="w-full text-left">
                <thead className="text-[6px] uppercase tracking-wide text-slate-400"><tr><th className="px-2 py-0.5">Time</th><th className="px-2 py-0.5">Course</th><th className="px-2 py-0.5">Staff</th><th className="px-2 py-0.5">Location</th><th className="px-2 py-0.5">Equipment</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {ses.map((s) => (
                    <tr key={s.course + s.slot} className="align-top">
                      <td className="whitespace-nowrap px-2 py-1"><span className="font-semibold text-navy">{s.slot === "AM" ? "Morning" : s.slot === "PM" ? "Afternoon" : "Evening"}</span><br /><span className="text-slate-400">{s.start}–{s.end}</span></td>
                      <td className="px-2 py-1"><span className="font-semibold text-navy">{s.course}</span><br /><Aud a={s.audience} /> {coverPill(s.cover)}</td>
                      <td className="px-2 py-1">{s.staff.map((x) => <span key={x.name} className="block"><span className="text-navy">{x.name}</span> <span className="text-slate-400">{x.role}</span></span>)}</td>
                      <td className="px-2 py-1 text-slate-600">{s.location}</td>
                      <td className="px-2 py-1 text-slate-600">{s.equipment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
