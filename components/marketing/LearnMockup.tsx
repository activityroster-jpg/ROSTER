/**
 * Faithful mini mock-ups of the real platform screens, for the Learning Centre.
 * These mirror the actual components' styling (navy/teal, cards, pills, the real
 * calendar/availability layouts) so a guide shows what the feature really looks
 * like. Purely presentational; no data or interactivity.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-port/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-starboard/60" />
        <span className="ml-2 truncate text-[11px] text-slate-400">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const Pill = ({ tone, children }: { tone: "youth" | "adult" | "all" | "covered" | "attention" | "conflict"; children: React.ReactNode }) => {
  const cls: Record<string, string> = {
    youth: "bg-amber/15 text-amber", adult: "bg-teal/15 text-teal", all: "bg-slate-100 text-slate-500",
    covered: "bg-starboard/15 text-starboard", attention: "bg-amber/15 text-amber", conflict: "bg-port/15 text-port",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls[tone]}`}>{children}</span>;
};

function DashboardMock() {
  const evts: Record<number, { t: string; n: string; a: "youth" | "adult" | "all" }[]> = {
    0: [{ t: "09:00", n: "Youth Stage 1", a: "youth" }],
    2: [{ t: "13:00", n: "Start Sailing", a: "adult" }],
    4: [{ t: "09:00", n: "Powerboat L2", a: "adult" }],
    5: [{ t: "10:00", n: "Summer Camp", a: "youth" }, { t: "14:00", n: "Taster", a: "all" }],
  };
  return (
    <Frame title="activityroster.com/office — Dashboard">
      <div className="mb-3 flex items-center gap-2">
        <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-navy">←</button>
        <span className="rounded-lg bg-navy px-2.5 py-1 text-xs font-semibold text-white">2–8 Jun · this week</span>
        <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-navy">→</button>
        <span className="ml-auto rounded-lg bg-teal px-2.5 py-1 text-xs font-semibold text-white">＋ New course</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => (
          <div key={d} className={`min-h-[4.5rem] rounded-lg border p-1 ${i === 3 ? "border-teal bg-teal/5" : "border-slate-100 bg-slate-50/40"}`}>
            <div className="text-center text-[9px] font-semibold uppercase text-slate-400">{d}</div>
            <div className="text-center text-[11px] font-bold text-navy">{i + 2}</div>
            {(evts[i] ?? []).map((e, j) => (
              <div key={j} className={`mt-1 rounded border-l-2 px-1 py-0.5 text-[8px] leading-tight ${e.a === "youth" ? "border-l-amber bg-amber/10 text-amber" : e.a === "adult" ? "border-l-teal bg-teal/10 text-teal" : "border-l-slate-400 bg-slate-100 text-slate-600"}`}>
                <span className="block font-semibold">{e.t}</span><span className="block truncate">{e.n}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function CoursesMock() {
  return (
    <Frame title="activityroster.com/office/courses">
      <div className="rounded-card border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-navy"><Pill tone="youth">Youth</Pill> Summer Camp (5-day)</p>
            <p className="mt-0.5 text-xs font-medium text-navy">📅 5 sessions · first Mon 2 Jun, 09:00–12:00</p>
            <p className="text-[11px] text-slate-500">National Sailing · scheduled · 2/2 staff</p>
          </div>
          <Pill tone="covered">Covered</Pill>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">Sam Jones · Senior Instructor</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">Alex Lee · Safety Boat</span>
        </div>
      </div>
    </Frame>
  );
}

function RosteringMock() {
  return (
    <Frame title="Assign staff — fit & availability checked">
      <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-navy">Sam Jones · ✓ available ▾</div>
        <div className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-navy">Senior Instructor ▾</div>
        <div className="sm:col-span-2 rounded-lg bg-amber/10 px-2.5 py-1.5 text-[11px] text-navy">⚠ Alex Lee said they&apos;re not available for this course&apos;s times — you can still assign them.</div>
        <div className="sm:col-span-2"><span className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Assign</span></div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Blocked names show the real reason — e.g. <span className="font-medium text-port">First Aid expired</span> — not just &ldquo;blocked&rdquo;.</p>
    </Frame>
  );
}

function AvailabilityMock() {
  const rows = [
    ["Free", "Free", "Busy"],
    ["Free", "Maybe", "—"],
    ["—", "Free", "Free"],
  ];
  const tone = (v: string) => v === "Free" ? "bg-starboard/15 text-starboard" : v === "Maybe" ? "bg-amber/15 text-amber" : v === "Busy" ? "bg-port/15 text-port" : "bg-slate-100 text-slate-400";
  return (
    <Frame title="Instructor portal — My availability">
      <div className="mb-2 flex items-center justify-between">
        <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-navy">←</button>
        <div className="text-center"><p className="text-xs font-semibold text-navy">2–8 Jun</p><p className="text-[10px] text-slate-400">This week</p></div>
        <button className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-navy">→</button>
      </div>
      {["Mon 2", "Tue 3", "Wed 4"].map((d, r) => (
        <div key={d} className="mb-1.5 flex items-center gap-2">
          <div className="w-14 flex-none"><div className="text-xs font-semibold text-navy">{d.split(" ")[0]}</div><div className="text-[10px] text-slate-400">{d.split(" ")[1]} Jun</div></div>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {rows[r]!.map((v, c) => (
              <div key={c} className={`rounded-lg py-1.5 text-center text-[10px] font-medium ${tone(v)}`}><span className="block text-[8px] uppercase opacity-70">{["AM", "PM", "EV"][c]}</span>{v}</div>
            ))}
          </div>
        </div>
      ))}
    </Frame>
  );
}

function BulkMock() {
  return (
    <Frame title="Bulk assign — one instructor, many courses">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-navy">Alex Lee ▾</div>
        <div className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-navy">Instructor ▾</div>
      </div>
      <div className="mt-2 space-y-1 rounded-lg border border-slate-100 p-2">
        {[["Youth Stage 1", "youth", true], ["Start Sailing", "adult", true], ["Powerboat L2", "adult", false]].map(([n, a, on], i) => (
          <label key={i} className="flex items-center gap-2 text-xs">
            <input type="checkbox" defaultChecked={on as boolean} readOnly />
            <Pill tone={a as "youth" | "adult"}>{a === "youth" ? "Youth" : "Adult"}</Pill>
            <span className="text-navy">{n as string}</span>
          </label>
        ))}
      </div>
      <div className="mt-2"><span className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Assign to 2 courses</span></div>
    </Frame>
  );
}

function IntegrationsMock() {
  return (
    <Frame title="Integrations — Check for updates">
      <div>
        <p className="mb-1 text-xs font-semibold text-navy">New in Bookwhen <span className="font-normal text-slate-400">(2)</span></p>
        {["RYA Youth Stage 2 · 14 Jun · AM", "Adult Improver · 15 Jun · PM"].map((t) => (
          <div key={t} className="mb-1 flex items-center gap-2 rounded-lg bg-starboard/5 px-2 py-1 text-[11px]"><input type="checkbox" defaultChecked readOnly /><span className="text-navy">{t}</span></div>
        ))}
      </div>
      <div className="mt-2">
        <p className="mb-1 text-xs font-semibold text-navy">Removed from Bookwhen <span className="font-normal text-slate-400">(1)</span></p>
        <div className="flex items-center gap-2 rounded-lg bg-port/5 px-2 py-1 text-[11px]"><input type="checkbox" readOnly /><span className="text-navy">Old Taster · 10 Jun</span><span className="ml-auto text-teal">Edit</span></div>
        <p className="mt-1 text-[10px] text-slate-400">Never deleted unless you tick it.</p>
      </div>
      <div className="mt-2"><span className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white">Apply — add 2, remove 0</span></div>
    </Frame>
  );
}

function StaffImportMock() {
  return (
    <Frame title="Import staff — review">
      {[["Sam Jones", "sam@club.org", []], ["Alex Lee", "not-an-email", ["Email looks invalid"]], ["Jo Patel", "", ["No email — can't invite"]]].map(([n, e, flags], i) => (
        <div key={i} className={`mb-1.5 rounded-lg border p-2 ${(flags as string[]).length ? "border-amber/40 bg-amber/5" : "border-slate-200"}`}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-navy">{n as string}</div>
            <div className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-500">{(e as string) || "—"}</div>
          </div>
          {(flags as string[]).map((f) => <span key={f} className="mt-1 mr-1 inline-block rounded bg-amber/15 px-1.5 py-0.5 text-[9px] font-medium text-amber">{f}</span>)}
        </div>
      ))}
    </Frame>
  );
}

function OnboardingMock() {
  return (
    <Frame title="Welcome — set up your centre">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
        {["How you run", "Courses", "Team", "Finish"].map((s, i) => (
          <span key={s} className="flex items-center gap-1"><span className={`flex h-4 w-4 items-center justify-center rounded-full ${i === 0 ? "bg-teal text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span><span className={i === 0 ? "text-navy" : "text-slate-400"}>{s}</span></span>
        ))}
      </div>
      <p className="text-xs font-semibold text-navy">What do you want to manage?</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[["Courses & team", true], ["Equipment & boats", false], ["Locations", false], ["Payroll", false]].map(([l, on], i) => (
          <div key={i} className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-[11px] ${on ? "border-teal bg-teal/5" : "border-slate-200"}`}><span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] ${on ? "bg-teal text-white" : "border border-slate-300"}`}>{on ? "✓" : ""}</span><span className="text-navy">{l as string}</span></div>
        ))}
      </div>
    </Frame>
  );
}

function PinMock() {
  return (
    <Frame title="Enter your 4-digit PIN">
      <div className="mx-auto max-w-[12rem] text-center">
        <p className="text-xs text-slate-500">A second check at every login</p>
        <div className="mt-3 flex justify-center gap-2">
          {[1, 2, 3, 4].map((i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold text-navy">{i < 3 ? "•" : ""}</span>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n} className="rounded-lg bg-slate-100 py-1.5 text-sm font-semibold text-navy">{n}</span>)}
        </div>
      </div>
    </Frame>
  );
}

const MOCKS: Record<string, () => React.ReactElement> = {
  "getting-started": OnboardingMock,
  dashboard: DashboardMock,
  courses: CoursesMock,
  rostering: RosteringMock,
  availability: AvailabilityMock,
  bulk: BulkMock,
  integrations: IntegrationsMock,
  "staff-import": StaffImportMock,
  "admin-security": PinMock,
};

export function LearnMockup({ id }: { id: string }) {
  const Mock = MOCKS[id];
  return Mock ? <Mock /> : null;
}

export const MOCKUP_IDS = new Set(Object.keys(MOCKS));
