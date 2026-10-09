import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrintButton } from "@/components/office/PrintButton";
import { Logo } from "@/components/Logo";
import { LETTER_SENDER } from "@/lib/marketing";
import { apexDomain } from "@/lib/config";
import { JURISDICTIONS, type Jurisdiction } from "@/lib/db/schema";
import { DEFAULT_COURSE_TYPES, DEFAULT_EQUIPMENT_TYPES, DEFAULT_LOCATION_TYPES, DEFAULT_ROLES, defaultComplianceTypes } from "@/lib/seed/catalogue";
import { TIERS, SMALL_CLUB_CAP } from "@/lib/tiers";
import { DEFAULT_PRICING, ON_SITE_DAY_PRICE, fmtMoney } from "@/lib/pricing";
import {
  BrowserFrame, CoursesScreen, DashboardScreen, InstructorAppScreen, PayrollScreen, StaffScreen, WeekRota, sampleData,
} from "@/components/admin/mockup/MockupScreens";

export const dynamic = "force-dynamic";

function fileName(name: string | null | undefined, id: string) {
  const safe = (name ?? "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `ActivityRoster-mockup-${safe ? `${safe}-` : ""}${id.slice(0, 8)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "";
  try { name = (await new PlatformRepository(await getDb()).prospectById(id))?.name ?? ""; } catch { /* id fallback */ }
  return { title: { absolute: fileName(name, id) } };
}

/** Best guess at the vetting regime from the prospect's region/country. */
function guessJurisdiction(region: string | null, country: string | null): Jurisdiction {
  const text = `${region ?? ""} ${country ?? ""}`.toLowerCase();
  const pick = (j: string) => JURISDICTIONS.find((x) => x === j) ?? "england";
  if (/northern ireland|antrim|down|armagh|derry|tyrone|fermanagh/.test(text)) return pick("northern_ireland");
  if (/\bireland\b|dublin|cork|galway|kerry|wicklow|republic/.test(text)) return pick("ireland");
  if (/scotland|highland|fife|lothian|argyll|clyde|strathclyde|aberdeen/.test(text)) return pick("scotland");
  if (/wales|cymru|anglesey|pembroke|gwynedd|cardiff|swansea/.test(text)) return pick("wales");
  return pick("england");
}

const FEATURES: [string, string][] = [
  ["Scheduling & rostering", "Build the week on a calendar; fit-checked as you go."],
  ["Compliance engine", "Ratios, safety-boat cover and licences enforced before anyone goes afloat."],
  ["Licence & vetting tracking", "Every RYA cert and check, with expiry alerts and a private document vault."],
  ["Time & attendance", "Clock in/out from the phone; timesheets build themselves."],
  ["Availability & leave", "Staff set availability and request leave in the app; you approve in a tap."],
  ["Open shifts & swaps", "Uncovered sessions offered to fit, available staff."],
  ["Payroll export", "Start, finish, lunch and pay per shift — spreadsheet or PDF, per person or period."],
  ["Instructor app", "Schedule, availability, hours and documents in every instructor's pocket."],
  ["Course import & booking systems", "Bring your schedule in from a spreadsheet or your booking system, matched to your course types."],
  ["Printable roster", "By week, by day or compact grid — choose which fields show."],
  ["HR & onboarding", "Records, invites and a new-starter checklist."],
  ["Audit trail & security", "Every change logged; PIN second factor; new-device password check."],
];

export default async function ProspectMockupPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const platform = new PlatformRepository(await getDb());
  const p = await platform.prospectById(id);
  if (!p) notFound();

  const d = sampleData(p.name);
  const apex = apexDomain();
  const url = `${d.slug}.${apex}`;
  const jurisdiction = guessJurisdiction(p.region, p.country);
  const checks = defaultComplianceTypes(jurisdiction);
  const courseGroups = new Map<string, string[]>();
  for (const c of DEFAULT_COURSE_TYPES) courseGroups.set(c.category ?? "Other", [...(courseGroups.get(c.category ?? "Other") ?? []), c.name]);
  const pricing = await platform.getPricing().catch(() => null);
  const setupPrice = pricing?.setupPrice ?? DEFAULT_PRICING.setupPrice;
  const currency = pricing?.currency ?? "GBP";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const greeting = p.contactName ? `Prepared for ${p.contactName}${p.contactRole ? `, ${p.contactRole}` : ""}` : "Prepared for the team";

  const Sheet = ({ children, title, n }: { children: React.ReactNode; title?: string; n: number }) => (
    <section className="sheet">
      {title ? (
        <div className="mb-4 flex items-end justify-between border-b border-slate-200 pb-2">
          <h2 className="font-display text-[18pt] font-bold text-navy">{title}</h2>
          <span className="text-[8pt] text-slate-400">{p.name} · ActivityRoster mock-up · {n}</span>
        </div>
      ) : null}
      {children}
    </section>
  );

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 8mm; background: #fff; padding: 14mm 14mm 12mm; position: relative; box-shadow: 0 1px 6px rgba(0,0,0,.12); break-after: page; }
        .sheet:last-child { break-after: auto; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; min-height: 0 !important; }
          .mockup-doc, .mockup-doc * { visibility: visible !important; }
          .mockup-doc { position: absolute !important; top: 0 !important; left: 0 !important; width: 210mm !important; margin: 0 !important; }
          .sheet { margin: 0 !important; box-shadow: none !important; min-height: 297mm; }
          .sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold text-navy">Mock-up for {p.name}</p>
          <p className="text-xs text-slate-500">Nine A4 pages: cover, setup summary, five screens of their admin & instructor app with sample data, a week roster, the feature list, and pricing &amp; next steps. Use “Save as PDF” to send it.</p>
        </div>
        <PrintButton label="Print / save as PDF" downloadName={fileName(p.name, id)} />
      </div>

      <div className="mockup-doc text-[9.5pt] text-slate-800">
        {/* 1 · Cover */}
        <Sheet n={1}>
          <div className="flex h-[269mm] flex-col rounded-2xl bg-navy p-12 text-white">
            <Logo variant="onDark" size="lg" />
            <p className="text-[9pt] text-white/60">{LETTER_SENDER.tagline}</p>
            <div className="mt-auto">
              <p className="text-[10pt] font-semibold uppercase tracking-wide text-[#4fd1c5]">Your platform, mocked up</p>
              <h1 className="mt-2 font-display text-[34pt] font-bold leading-tight">{p.name}</h1>
              <p className="mt-3 text-[13pt] text-white/80">on ActivityRoster — rostering, compliance, hours and payroll in one place, set up for how you run.</p>
              <p className="mt-10 inline-block rounded-lg bg-white/10 px-4 py-2 font-mono text-[11pt] ring-1 ring-white/20">https://{url}</p>
            </div>
            <div className="mt-auto flex items-end justify-between text-[9pt] text-white/70">
              <span>{greeting}<br />{today}</span>
              <span className="text-right">{LETTER_SENDER.email}<br />{LETTER_SENDER.website}</span>
            </div>
          </div>
        </Sheet>

        {/* 2 · Setup summary */}
        <Sheet n={2} title="What we'd set up for you">
          <p className="mb-4 text-[10pt] text-slate-600">Every centre starts with the RYA defaults below, then we tailor them to {p.name}. Nothing here is fixed — grades, roles, checks, course types, boats and locations are all yours to edit.</p>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <h3 className="mb-1 font-semibold text-navy">Your centre</h3>
              <table className="w-full text-[9pt]"><tbody>
                {[["Centre", p.name], ["Web address", `${url}`], ["Region", p.region ?? "—"], ["Vetting regime", checks.find((c) => /dbs|pvg|access|vetting|garda/i.test(c.name))?.name ?? "DBS"], ["Admin logins", "Unlimited, PIN-protected"], ["Instructor app", "Every instructor, free"]].map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100"><td className="py-1 pr-3 text-slate-500">{k}</td><td className="py-1 font-medium text-navy">{v}</td></tr>
                ))}
              </tbody></table>
              <h3 className="mb-1 mt-5 font-semibold text-navy">Roles</h3>
              <p className="text-[9pt] text-slate-700">{DEFAULT_ROLES.map((r) => r.name).join(" · ")}</p>
              <h3 className="mb-1 mt-5 font-semibold text-navy">Compliance checks ({jurisdiction.replace("_", " ")})</h3>
              <ul className="text-[9pt] text-slate-700">{checks.map((c) => <li key={c.code}>• {c.name}{c.mandatory ? <span className="ml-1 rounded bg-port/10 px-1 text-[7pt] font-semibold text-port">mandatory</span> : null}</li>)}</ul>
              <h3 className="mb-1 mt-5 font-semibold text-navy">Equipment & locations</h3>
              <p className="text-[9pt] text-slate-700">{DEFAULT_EQUIPMENT_TYPES.filter((e) => e.inventoryTracked).map((e) => e.name).join(" · ")}</p>
              <p className="mt-1 text-[9pt] text-slate-700">{DEFAULT_LOCATION_TYPES.join(" · ")}</p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-navy">Course types (RYA schemes)</h3>
              {[...courseGroups.entries()].map(([group, names]) => (
                <div key={group} className="mb-2">
                  <p className="text-[8pt] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                  <p className="text-[9pt] text-slate-700">{names.join(" · ")}</p>
                </div>
              ))}
              <p className="mt-3 rounded-lg bg-teal/5 p-3 text-[9pt] text-slate-700">Run something we haven&apos;t listed? Add it in a minute — or import your whole season from a spreadsheet or your booking system and we match each course to the right type.</p>
            </div>
          </div>
        </Sheet>

        {/* 3 · Dashboard */}
        <Sheet n={3} title="Your office · Dashboard">
          <p className="mb-3 text-[10pt] text-slate-600">The first screen every morning: today&apos;s sessions, who&apos;s on, and anything that needs you — with sample data for {p.name}.</p>
          <BrowserFrame url={`${url}/office`}><DashboardScreen d={d} /></BrowserFrame>
          <p className="mt-3 text-[9pt] text-slate-500">Red and amber flags are the compliance engine: a course without safety-boat cover, an under-staffed group, a licence about to expire, a blocked instructor. They appear before anyone reaches the water.</p>
        </Sheet>

        {/* 4 · Courses */}
        <Sheet n={4} title="Your office · Courses">
          <p className="mb-3 text-[10pt] text-slate-600">A week calendar plus every course as an editable card. Click a day to add a session; each course shows the staff it needs by role and who&apos;s filled it.</p>
          <BrowserFrame url={`${url}/office/courses`}><CoursesScreen d={d} /></BrowserFrame>
          <p className="mt-3 text-[9pt] text-slate-500">Courses can be any pattern of sessions — a five-day camp, a Wednesday evening club, two Saturday mornings — with exact times, locations and equipment. Default schedules per course type fill them in one click.</p>
        </Sheet>

        {/* 5 · Staff */}
        <Sheet n={5} title="Your office · Staff">
          <p className="mb-3 text-[10pt] text-slate-600">Everyone who runs sessions, what they can teach, and whether they&apos;re fit to roster today.</p>
          <BrowserFrame url={`${url}/office/staff`}><StaffScreen d={d} /></BrowserFrame>
          <p className="mt-3 text-[9pt] text-slate-500">Someone with a lapsed first aid or vetting check can&apos;t be assigned — you&apos;d have to override on purpose, and that override is recorded.</p>
        </Sheet>

        {/* 6 · Payroll + instructor app */}
        <Sheet n={6} title="Payroll · and the instructor app">
          <BrowserFrame url={`${url}/office/finance`}><PayrollScreen d={d} /></BrowserFrame>
          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-6">
            <div className="text-[9.5pt] text-slate-600">
              <h3 className="font-semibold text-navy">What your instructors see</h3>
              <p className="mt-1">Their own app on any phone: next session with one-tap clock-in, their week, availability they set themselves, their licences and expiry dates, open shifts to claim and leave to request. No app store, no training.</p>
              <p className="mt-2">Hours flow from clock-in/out straight into Payroll, with your lunch-break rule applied.</p>
            </div>
            <InstructorAppScreen d={d} />
          </div>
        </Sheet>

        {/* 7 · Week roster */}
        <Sheet n={7} title={`Sample week roster · ${d.weekLabel}`}>
          <p className="mb-3 text-[9.5pt] text-slate-600">Printed straight from the Roster page (“By week” template). Switch fields on or off — times, names, roles, locations, equipment, safety-cover status — and print by day or as a compact grid instead.</p>
          <WeekRota d={d} />
        </Sheet>

        {/* 8 · Features */}
        <Sheet n={8} title="What's included — all of it, on every plan">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {FEATURES.map(([t, b]) => (
              <div key={t} className="rounded-lg border border-slate-200 p-3"><p className="font-semibold text-navy">{t}</p><p className="mt-0.5 text-[9pt] text-slate-600">{b}</p></div>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-navy p-4 text-white">
            <p className="font-semibold">Built for RYA centres, hosted in the EU</p>
            <p className="mt-1 text-[9pt] text-white/80">UK GDPR-ready · each centre&apos;s data strictly isolated · export everything any time · England, Wales, Scotland, Northern Ireland and Ireland vetting regimes built in.</p>
          </div>
        </Sheet>

        {/* 9 · Pricing & next steps */}
        <Sheet n={9} title="Pricing & next steps">
          <p className="mb-4 text-[10pt] text-slate-600">One flat price per centre — never per user. Add every instructor and volunteer. First month free, no card needed.</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[8pt] font-semibold uppercase tracking-wide text-slate-400">{TIERS.small_club.name}</p>
              <p className="mt-1 font-display text-[22pt] font-bold text-navy">{fmtMoney(TIERS.small_club.monthlyPrice, currency)}<span className="text-[10pt] font-normal text-slate-500">/mo</span></p>
              <p className="text-[8.5pt] text-slate-500">or {fmtMoney(TIERS.small_club.annualPrice, currency)}/yr</p>
              <p className="mt-2 text-[9pt] text-slate-600">Up to {SMALL_CLUB_CAP} people on the team. Everything included.</p>
            </div>
            <div className="rounded-xl border-2 border-teal p-4">
              <p className="text-[8pt] font-semibold uppercase tracking-wide text-teal">{TIERS.standard.name} · most centres</p>
              <p className="mt-1 font-display text-[22pt] font-bold text-navy">{fmtMoney(TIERS.standard.monthlyPrice, currency)}<span className="text-[10pt] font-normal text-slate-500">/mo</span></p>
              <p className="text-[8.5pt] text-slate-500">or {fmtMoney(TIERS.standard.annualPrice, currency)}/yr</p>
              <p className="mt-2 text-[9pt] text-slate-600">Unlimited instructors and volunteers. Everything included.</p>
            </div>
            <div className="rounded-xl border border-amber/60 bg-amber/5 p-4">
              <p className="text-[8pt] font-semibold uppercase tracking-wide text-amber-700">Custom platform · recommended</p>
              <p className="mt-1 font-display text-[22pt] font-bold text-navy">{fmtMoney(setupPrice, currency)}</p>
              <p className="text-[8.5pt] text-slate-500">+ {fmtMoney(ON_SITE_DAY_PRICE, currency)} on-site day · then {fmtMoney(TIERS.standard.monthlyPrice, currency)}/mo</p>
              <p className="mt-2 text-[9pt] text-slate-600">We build it around how {p.name} runs, import your data and train the team in person.</p>
            </div>
          </div>
          <p className="mt-2 text-[8pt] text-slate-400">Prices exclude VAT where applicable. Compared with per-user tools at a typical centre headcount, the flat price is the cheaper option at every size.</p>

          <h3 className="mb-2 mt-8 font-display text-[14pt] font-bold text-navy">Next steps</h3>
          <ol className="space-y-2 text-[10pt] text-slate-700">
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal font-bold text-white">1</span><strong>Book a 30-minute call</strong> — we walk through this mock-up live with your real courses. <span className="text-teal">https://{apex}/contact</span></li>
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal font-bold text-white">2</span><strong>Start your free month</strong> — your centre is created instantly at <span className="font-mono text-navy">{url}</span>; no card required. <span className="text-teal">https://{apex}/#get-demo</span></li>
            <li><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal font-bold text-white">3</span><strong>Or let us do it</strong> — the custom build: we set everything up, on site if you like, and hand you the keys.</li>
          </ol>
          <div className="mt-10 border-t border-slate-200 pt-4 text-[9.5pt] text-slate-600">
            <p className="font-semibold text-navy">{LETTER_SENDER.signOffName} · {LETTER_SENDER.name}</p>
            <p>{LETTER_SENDER.email} · {LETTER_SENDER.website}</p>
          </div>
        </Sheet>
      </div>
    </>
  );
}
