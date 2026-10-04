"use client";

import { useEffect, useState } from "react";
import type { RotaDay, RotaSession } from "@/lib/services/schedule";
import { AUDIENCE_META } from "@/lib/features";
import { WelfareDutyPicker } from "./WelfareDutyPicker";

/** The three roster templates. */
export type RotaTemplate = "week" | "day" | "grid";

/** Fields a centre can show or hide on every template. */
const FIELDS = [
  { key: "times", label: "Times" },
  { key: "staff", label: "Instructor names" },
  { key: "role", label: "Role" },
  { key: "location", label: "Location" },
  { key: "equipment", label: "Equipment" },
  { key: "cover", label: "Safety-cover status" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];
type Fields = Record<FieldKey, boolean>;

const ALL_ON: Fields = { times: true, staff: true, role: true, location: true, equipment: true, cover: true };
const STORAGE = "ar.rota.prefs";
const SLOT_LABEL: Record<string, string> = { AM: "Morning", PM: "Afternoon", EV: "Evening" };
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function loadPrefs(): { template: RotaTemplate; fields: Fields } {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE) : null;
    if (raw) {
      const p = JSON.parse(raw) as { template?: RotaTemplate; fields?: Partial<Fields> };
      const template = p.template === "day" || p.template === "grid" ? p.template : "week";
      return { template, fields: { ...ALL_ON, ...(p.fields ?? {}) } };
    }
  } catch { /* private mode / blocked storage — fall through to defaults */ }
  return { template: "week", fields: ALL_ON };
}

function CoverBadge({ s }: { s: RotaSession }) {
  if (s.missingSafetyCover) return <span className="rounded-full bg-port/15 px-1.5 py-0.5 text-[10px] font-semibold text-port">No safety cover</span>;
  if (s.understaffed || s.staff.length === 0) return <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber">Needs cover</span>;
  return <span className="rounded-full bg-starboard/15 px-1.5 py-0.5 text-[10px] font-semibold text-starboard">Covered</span>;
}

/** Problems the office should see on this session (from the problems service), as a small count with the detail on hover. */
function ProblemBadge({ id, problems }: { id: string; problems?: Record<string, string[]> }) {
  const list = problems?.[id];
  if (!list?.length) return null;
  return <span title={list.join("\n")} className="rounded-full bg-port/15 px-1.5 py-0.5 text-[10px] font-semibold text-port print:hidden">⚠ {list.length}</span>;
}

function Staff({ s, f, compact = false }: { s: RotaSession; f: Fields; compact?: boolean }) {
  if (!f.staff && !f.role) return null;
  if (s.staff.length === 0) return <span className="text-xs text-port">Unassigned</span>;
  const items = s.staff.map((m, i) => (
    <li key={i} className={compact ? "inline" : ""}>
      {f.staff ? <span className={m.status === "declined" ? "text-slate-400 line-through" : "text-navy"}>{m.name}</span> : null}
      {f.role ? <span className={`text-xs text-slate-400 ${f.staff ? "ml-1" : ""}`}>{m.role}</span> : null}
      {m.status === "confirmed" ? <span className="ml-1 text-[10px] font-semibold text-starboard" title="Confirmed by the instructor">✓</span> : null}
      {m.status === "declined" ? <span className="ml-1 rounded bg-port/10 px-1 text-[10px] font-semibold text-port">can&apos;t make it</span> : null}
      {compact && i < s.staff.length - 1 ? <span className="text-slate-300">, </span> : null}
    </li>
  ));
  return <ul className={compact ? "inline" : "space-y-0.5"}>{items}</ul>;
}

function Audience({ s }: { s: RotaSession }) {
  const a = AUDIENCE_META[s.audience];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.audience === "youth" ? "bg-amber/15 text-amber" : s.audience === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a.short}</span>;
}

/* ---------- Template: By week (one table per day) ---------- */
function Welfare({ day, officers, canEdit }: { day: RotaDay; officers: string[]; canEdit: boolean }) {
  if (officers.length === 0) return null;
  const slots = (["AM", "PM", "EV"] as const).filter((s) => day.sessions.some((x) => x.slot === s) || day.welfare?.[s]);
  if (slots.length === 0) return null;
  return <div className="px-4 py-1.5"><WelfareDutyPicker date={day.date} slots={slots} bySlot={day.welfare ?? {}} officers={officers} canEdit={canEdit} /></div>;
}

function ByWeek({ rota, f, officers, canEdit, problems }: { rota: RotaDay[]; f: Fields; officers: string[]; canEdit: boolean; problems?: Record<string, string[]> }) {
  return (
    <div className="space-y-4">
      {rota.map((day) => (
        <div key={day.date} className="break-inside-avoid rounded-card border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 font-semibold text-navy print:bg-white">{day.label}</div>
          <Welfare day={day} officers={officers} canEdit={canEdit} />
          {day.sessions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No sessions.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  {f.times ? <th className="px-4 py-2 font-semibold">Time</th> : null}
                  <th className="px-4 py-2 font-semibold">Course</th>
                  {f.staff || f.role ? <th className="px-4 py-2 font-semibold">Instructors</th> : null}
                  {f.location ? <th className="px-4 py-2 font-semibold">Location</th> : null}
                  {f.equipment ? <th className="px-4 py-2 font-semibold">Equipment</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {day.sessions.map((s) => (
                  <tr key={s.sessionId} className="align-top">
                    {f.times ? (
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                        <div className="font-medium text-navy">{SLOT_LABEL[s.slot] ?? s.slot}</div>
                        <div className="text-xs text-slate-400">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div>
                      </td>
                    ) : null}
                    <td className="px-4 py-2">
                      <div className="font-medium text-navy">{s.courseName}</div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                        <Audience s={s} /> {s.courseTypeName}
                        {f.cover ? <CoverBadge s={s} /> : null}
                        <ProblemBadge id={s.sessionId} problems={problems} />
                      </div>
                    </td>
                    {f.staff || f.role ? <td className="px-4 py-2 text-slate-600"><Staff s={s} f={f} /></td> : null}
                    {f.location ? <td className="px-4 py-2 text-slate-600">{s.locations.length ? s.locations.join(", ") : <span className="text-xs text-slate-400">—</span>}</td> : null}
                    {f.equipment ? <td className="px-4 py-2 text-slate-600">{s.equipment.length ? s.equipment.join(", ") : <span className="text-xs text-slate-400">—</span>}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Template: By day (one page per day, big cards) ---------- */
function ByDay({ rota, f, officers, canEdit, problems }: { rota: RotaDay[]; f: Fields; officers: string[]; canEdit: boolean; problems?: Record<string, string[]> }) {
  const [idx, setIdx] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const i = rota.findIndex((d) => d.date === today);
    return i >= 0 ? i : 0;
  });
  const day = rota[Math.min(idx, rota.length - 1)];
  if (!day) return null;
  return (
    <div>
      {/* On screen: one day at a time. In print: every day, one per page. */}
      <div className="mb-3 flex flex-wrap items-center gap-1 print:hidden">
        {rota.map((d, i) => (
          <button key={d.date} type="button" onClick={() => setIdx(i)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${i === idx ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>
            {d.label.split(" ")[0]} <span className="text-xs opacity-70">{d.sessions.length}</span>
          </button>
        ))}
      </div>
      {rota.map((d, i) => (
        <section key={d.date} className={`${i === idx ? "" : "hidden print:block"} print:break-after-page`}>
          <h2 className="mb-1 font-display text-xl font-bold text-navy">{d.label}</h2>
          <div className="mb-3 -mx-4"><Welfare day={d} officers={officers} canEdit={canEdit} /></div>
          {d.sessions.length === 0 ? (
            <p className="rounded-card border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No sessions.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.sessions.map((s) => (
                <div key={s.sessionId} className="break-inside-avoid rounded-card border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold text-navy">{s.courseName}</div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400"><Audience s={s} /> {s.courseTypeName}</div>
                    </div>
                    {f.times ? <div className="whitespace-nowrap text-right"><div className="font-semibold text-navy">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div><div className="text-xs text-slate-400">{SLOT_LABEL[s.slot] ?? s.slot}</div></div> : null}
                  </div>
                  <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
                    {f.staff || f.role ? <><dt className="text-xs font-semibold uppercase text-slate-400">Instructors</dt><dd><Staff s={s} f={f} /></dd></> : null}
                    {f.location ? <><dt className="text-xs font-semibold uppercase text-slate-400">Location</dt><dd className="text-slate-700">{s.locations.join(", ") || "—"}</dd></> : null}
                    {f.equipment ? <><dt className="text-xs font-semibold uppercase text-slate-400">Equipment</dt><dd className="text-slate-700">{s.equipment.join(", ") || "—"}</dd></> : null}
                    {f.cover ? <><dt className="text-xs font-semibold uppercase text-slate-400">Cover</dt><dd><CoverBadge s={s} /> <ProblemBadge id={s.sessionId} problems={problems} /></dd></> : null}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------- Template: Compact grid (days across, slots down) ---------- */
function CompactGrid({ rota, f, problems }: { rota: RotaDay[]; f: Fields; problems?: Record<string, string[]> }) {
  const slots = (["AM", "PM", "EV"] as const).filter((code) => rota.some((d) => d.sessions.some((s) => s.slot === code)));
  const rows = slots.length ? slots : (["AM", "PM"] as const);
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-50 print:bg-white">
            <th className="w-20 border-b border-r border-slate-200 px-2 py-2 text-[10px] font-semibold uppercase text-slate-400"></th>
            {rota.map((d) => (
              <th key={d.date} className="border-b border-r border-slate-200 px-2 py-2 font-semibold text-navy last:border-r-0">
                {d.label.split(" ")[0]} <span className="font-normal text-slate-400">{d.date.slice(8)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((code) => (
            <tr key={code} className="align-top">
              <th className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-semibold uppercase text-slate-500 print:bg-white">{SLOT_LABEL[code]}</th>
              {rota.map((d) => {
                const cell = d.sessions.filter((s) => s.slot === code);
                return (
                  <td key={d.date} className="border-b border-r border-slate-200 px-1.5 py-1.5 last:border-r-0">
                    {cell.length === 0 ? <span className="text-slate-300">—</span> : (
                      <div className="space-y-1.5">
                        {cell.map((s) => (
                          <div key={s.sessionId} className={`break-inside-avoid rounded border-l-4 px-1.5 py-1 ${s.audience === "youth" ? "border-l-amber bg-amber/5" : s.audience === "adult" ? "border-l-teal bg-teal/5" : "border-l-slate-400 bg-slate-50"}`}>
                            <div className="font-semibold leading-tight text-navy">{s.courseName}</div>
                            {f.times ? <div className="text-[10px] text-slate-500">{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div> : null}
                            {f.staff || f.role ? <div className="leading-tight"><Staff s={s} f={f} compact /></div> : null}
                            {f.location && s.locations.length ? <div className="text-[10px] text-slate-500">📍 {s.locations.join(", ")}</div> : null}
                            {f.equipment && s.equipment.length ? <div className="text-[10px] text-slate-500">⛵ {s.equipment.join(", ")}</div> : null}
                            {f.cover ? <div className="mt-0.5"><CoverBadge s={s} /> <ProblemBadge id={s.sessionId} problems={problems} /></div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The printable roster in three templates (by week, by day, compact grid), with
 * each field switchable. Choices are remembered in this browser.
 */
export function RotaView({ rota, welfareOfficers = [], canEditWelfare = false, problems }: { rota: RotaDay[]; welfareOfficers?: string[]; canEditWelfare?: boolean; problems?: Record<string, string[]> }) {
  const [template, setTemplate] = useState<RotaTemplate>("week");
  const [fields, setFields] = useState<Fields>(ALL_ON);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = loadPrefs();
    setTemplate(p.template);
    setFields(p.fields);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE, JSON.stringify({ template, fields })); } catch { /* ignore */ }
  }, [template, fields, ready]);

  const tabs: { id: RotaTemplate; label: string; hint: string }[] = [
    { id: "week", label: "By week", hint: "A table per day — the classic wall roster" },
    { id: "day", label: "By day", hint: "Big cards, one day per page" },
    { id: "grid", label: "Compact grid", hint: "Whole week on one page" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-slate-200 bg-white px-3 py-2 print:hidden">
        <div className="flex items-center gap-1" role="tablist" aria-label="Roster template">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={template === t.id} title={t.hint} onClick={() => setTemplate(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${template === t.id ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Show</span>
          {FIELDS.map((fd) => (
            <label key={fd.key} className="flex items-center gap-1">
              <input type="checkbox" checked={fields[fd.key]} onChange={(e) => setFields((f) => ({ ...f, [fd.key]: e.target.checked }))} />
              {fd.label}
            </label>
          ))}
        </div>
      </div>

      {template === "week" ? <ByWeek rota={rota} f={fields} officers={welfareOfficers} canEdit={canEditWelfare} problems={problems} /> : template === "day" ? <ByDay rota={rota} f={fields} officers={welfareOfficers} canEdit={canEditWelfare} problems={problems} /> : <CompactGrid rota={rota} f={fields} problems={problems} />}
    </div>
  );
}
