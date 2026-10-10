"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePayRatesAction } from "@/app/(app)/office/settings/pay-actions";

export type PayUnitValue = "hour" | "session" | "day";
export interface RateRow { instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null; unit: PayUnitValue; rate: number }
export interface NamedItem { id: string; name: string }
export interface PersonItem { id: string; name: string; employment: string }

const UNITS: { value: PayUnitValue; label: string }[] = [
  { value: "hour", label: "per hour" },
  { value: "session", label: "per session" },
  { value: "day", label: "per day" },
];
const unitLabel = (u: PayUnitValue) => UNITS.find((x) => x.value === u)?.label ?? u;
const keyOf = (r: { instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null }) => `${r.instructorId ?? ""}|${r.roleTypeId ?? ""}|${r.courseTypeId ?? ""}`;
const parseKey = (k: string) => { const [i, r, c] = k.split("|"); return { instructorId: i || null, roleTypeId: r || null, courseTypeId: c || null }; };
const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

interface Draft { amount: string; unit: PayUnitValue }

/** Every rate on the page as an editable draft; Save sends only what changed. */
function useDraft(initial: RateRow[]) {
  const original = useMemo(() => new Map(initial.map((r) => [keyOf(r), { amount: String(r.rate), unit: r.unit } as Draft])), [initial]);
  const [draft, setDraft] = useState<Map<string, Draft>>(() => new Map(original));
  const get = (k: string): Draft => draft.get(k) ?? { amount: "", unit: "hour" };
  const set = (k: string, patch: Partial<Draft>) => setDraft((d) => { const n = new Map(d); n.set(k, { ...(n.get(k) ?? { amount: "", unit: "hour" }), ...patch }); return n; });
  const drop = (k: string) => setDraft((d) => { const n = new Map(d); if (original.has(k)) n.set(k, { amount: "", unit: original.get(k)!.unit }); else n.delete(k); return n; });
  const changes = useMemo(() => {
    const out: { instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null; unit: PayUnitValue; rate: number | null }[] = [];
    const keys = new Set([...original.keys(), ...draft.keys()]);
    for (const k of keys) {
      const was = original.get(k), now = draft.get(k);
      const amount = now?.amount.trim() ?? "";
      if (amount === "") { if (was) out.push({ ...parseKey(k), unit: was.unit, rate: null }); continue; }
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) continue;
      if (was && Number(was.amount) === n && was.unit === now!.unit) continue;
      out.push({ ...parseKey(k), unit: now!.unit, rate: n });
    }
    return out;
  }, [draft, original]);
  const invalid = [...draft.values()].some((d) => d.amount.trim() !== "" && !(Number.isFinite(Number(d.amount)) && Number(d.amount) >= 0));
  const reset = () => setDraft(new Map(original));
  return { draft, get, set, drop, changes, invalid, reset };
}

function AmountUnit({ value, onChange, currency, placeholder, label }: { value: Draft; onChange: (p: Partial<Draft>) => void; currency: string; placeholder?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-slate-400">{currency}</span>
      <input type="number" min={0} step={0.5} inputMode="decimal" value={value.amount} onChange={(e) => onChange({ amount: e.target.value })} placeholder={placeholder ?? "—"} aria-label={`${label}: amount`} className={`${field} w-24`} />
      <select value={value.unit} onChange={(e) => onChange({ unit: e.target.value as PayUnitValue })} aria-label={`${label}: paid`} className={field}>
        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
    </span>
  );
}

/** Add a rate for a particular course: pick the course, then set the amount like any other rate. */
function AddCourseRate({ courses, taken, onAdd, label = "+ Different rate on a course", startOpen = false }: { courses: NamedItem[]; taken: Set<string>; onAdd: (courseTypeId: string) => void; label?: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const free = courses.filter((c) => !taken.has(c.id));
  if (free.length === 0) return null;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-teal hover:underline">{label}</button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onAdd(e.target.value); setOpen(false); } }} aria-label="Course" className={field}>
        <option value="">Choose a course…</option>
        {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-navy">Cancel</button>
    </span>
  );
}

function SaveBar({ count, invalid, pending, msg, onSave, onReset }: { count: number; invalid: boolean; pending: boolean; msg: { ok: boolean; text: string } | null; onSave: (applyFrom: string | null) => void; onReset: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [applyOn, setApplyOn] = useState(true);
  const [applyFrom, setApplyFrom] = useState(today);
  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-card border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <button type="button" disabled={pending || count === 0 || invalid} onClick={() => onSave(applyOn ? applyFrom : null)} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "Saving…" : count ? `Save ${count} change${count === 1 ? "" : "s"}` : "No changes"}
      </button>
      {count ? <button type="button" disabled={pending} onClick={onReset} className="text-xs text-slate-500 hover:text-navy">Undo changes</button> : null}
      <label className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <input type="checkbox" checked={applyOn} onChange={(e) => setApplyOn(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Also re-price unapproved payroll lines from
        <input type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} disabled={!applyOn} aria-label="Re-price from" className={`${field} py-1 disabled:bg-slate-50`} />
        <span className="text-slate-400">(approved lines keep their pay)</span>
      </label>
      {invalid ? <span className="text-xs text-port">Amounts must be numbers, 0 or more.</span> : null}
      {msg ? <span role="status" className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
    </div>
  );
}

function useSave(changes: ReturnType<typeof useDraft>["changes"]) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (applyFrom: string | null) => {
    setMsg(null);
    start(async () => {
      try {
        const r = await savePayRatesAction({ changes, applyFrom });
        setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "That didn't save" });
        if (r.ok) router.refresh();
      } catch { setMsg({ ok: false, text: "That didn't save. Reload the page and try again." }); }
    });
  };
  return { pending, msg, save };
}

/**
 * Settings → Pay rates. The centre's standard rate for each role (with
 * different rates on particular courses where needed), then everyone listed
 * with their own rate and their course rates. The most specific rate wins.
 */
export function PayRatesSettings({ currency, roles, courses, people, rates }: { currency: string; roles: NamedItem[]; courses: NamedItem[]; people: PersonItem[]; rates: RateRow[] }) {
  const d = useDraft(rates);
  const { pending, msg, save } = useSave(d.changes);
  const [q, setQ] = useState("");
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "a retired course";
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "a retired role";
  const keysWhere = (pred: (k: { instructorId: string | null; roleTypeId: string | null; courseTypeId: string | null }) => boolean) => [...d.draft.keys()].filter((k) => pred(parseKey(k)));
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      {/* 1. Standard rates */}
      <section className="rounded-card border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-navy">1 · Standard rates by role</h3>
        <p className="mt-1 text-xs text-slate-500">What someone in each role is paid, unless they have their own rate below. Add a different rate for a course where it pays differently (say, camps per day). Leave a role blank to fall back to &ldquo;Everyone else&rdquo;.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {[...roles.map((r) => ({ id: r.id as string | null, name: r.name })), { id: null, name: "Everyone else (any other role)" }].map((r) => {
            const k = keyOf({ instructorId: null, roleTypeId: r.id, courseTypeId: null });
            const courseKeys = r.id ? keysWhere((x) => !x.instructorId && x.roleTypeId === r.id && Boolean(x.courseTypeId)) : [];
            return (
              <div key={k} className="py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-56 text-sm font-medium text-navy">{r.name}</span>
                  <AmountUnit value={d.get(k)} onChange={(p) => d.set(k, p)} currency={currency} label={r.name} />
                  {r.id ? <AddCourseRate courses={courses} taken={new Set(courseKeys.map((x) => parseKey(x).courseTypeId!))} onAdd={(cid) => d.set(keyOf({ instructorId: null, roleTypeId: r.id, courseTypeId: cid }), { amount: "", unit: d.get(k).unit })} /> : null}
                </div>
                {courseKeys.length ? (
                  <ul className="mt-2 space-y-1.5 pl-4 sm:pl-60">
                    {courseKeys.map((ck) => (
                      <li key={ck} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-600">on {courseName(parseKey(ck).courseTypeId)}</span>
                        <AmountUnit value={d.get(ck)} onChange={(p) => d.set(ck, p)} currency={currency} label={`${r.name} on ${courseName(parseKey(ck).courseTypeId)}`} />
                        <button type="button" onClick={() => d.drop(ck)} className="text-xs text-slate-400 hover:text-port">Remove</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Each person */}
      <section className="mt-6 rounded-card border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-navy">2 · Each person</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone…" aria-label="Find someone" className={`${field} w-56`} />
        </div>
        <p className="mt-1 text-xs text-slate-500">Leave blank to use the standard rates. Their own rate applies on every course; add a course rate where they&rsquo;re paid differently. Volunteers usually have no rate: their hours still show, with pay blank.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {shown.map((p) => {
            const k = keyOf({ instructorId: p.id, roleTypeId: null, courseTypeId: null });
            const extraKeys = keysWhere((x) => x.instructorId === p.id && Boolean(x.courseTypeId || x.roleTypeId));
            const isOpen = openPerson === p.id;
            return (
              <div key={p.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-56 text-sm font-medium text-navy">{p.name}{p.employment === "volunteer" ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">volunteer</span> : null}</span>
                  <AmountUnit value={d.get(k)} onChange={(x) => d.set(k, x)} currency={currency} placeholder="standard" label={`${p.name}'s own rate`} />
                  <button type="button" onClick={() => setOpenPerson(isOpen ? null : p.id)} className="text-xs font-medium text-teal hover:underline">
                    {extraKeys.length ? `Course rates (${extraKeys.length})` : "+ Course rate"}
                  </button>
                </div>
                {isOpen || extraKeys.length ? (
                  <ul className="mt-2 space-y-1.5 pl-4 sm:pl-60">
                    {extraKeys.map((ck) => {
                      const x = parseKey(ck);
                      const what = x.courseTypeId ? `on ${courseName(x.courseTypeId)}` : `as ${roleName(x.roleTypeId)}`;
                      return (
                        <li key={ck} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-slate-600">{what}</span>
                          <AmountUnit value={d.get(ck)} onChange={(v) => d.set(ck, v)} currency={currency} label={`${p.name} ${what}`} />
                          <button type="button" onClick={() => d.drop(ck)} className="text-xs text-slate-400 hover:text-port">Remove</button>
                        </li>
                      );
                    })}
                    {isOpen ? <li><AddCourseRate startOpen={extraKeys.length === 0} label="+ Add a course rate" courses={courses} taken={new Set(extraKeys.map((x) => parseKey(x).courseTypeId).filter((x): x is string => Boolean(x)))} onAdd={(cid) => d.set(keyOf({ instructorId: p.id, roleTypeId: null, courseTypeId: cid }), { amount: "", unit: d.get(k).unit })} /></li> : null}
                  </ul>
                ) : null}
              </div>
            );
          })}
          {shown.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">{people.length ? "Nobody matches." : "No instructors yet."}</p> : null}
        </div>
      </section>

      <SaveBar count={d.changes.length} invalid={d.invalid} pending={pending} msg={msg} onSave={save} onReset={d.reset} />
    </div>
  );
}

/**
 * One person's pay on their staff profile: their own rate (or the standard
 * rates), and their course rates. The same rates as Settings → Pay rates.
 */
export function PersonPayRates({ currency, person, courses, roles, rates, standard }: {
  currency: string;
  person: PersonItem;
  courses: NamedItem[];
  roles: NamedItem[];
  /** This person's own rates. */
  rates: RateRow[];
  /** The centre's standard rates by role, shown for reference. */
  standard: { label: string; rate: number; unit: PayUnitValue }[];
}) {
  const d = useDraft(rates);
  const { pending, msg, save } = useSave(d.changes);
  const k = keyOf({ instructorId: person.id, roleTypeId: null, courseTypeId: null });
  const extraKeys = [...d.draft.keys()].filter((x) => { const p = parseKey(x); return p.instructorId === person.id && Boolean(p.courseTypeId || p.roleTypeId); });
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "a retired course";
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "a retired role";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">Their own rate</span>
        <AmountUnit value={d.get(k)} onChange={(x) => d.set(k, x)} currency={currency} placeholder="standard" label="Their own rate" />
      </div>
      {d.get(k).amount.trim() === "" ? (
        <p className="mt-1 text-xs text-slate-400">
          Blank: they&rsquo;re paid the standard rate for the role they work in{standard.length ? ` (${standard.map((s) => `${s.label} ${currency}${s.rate} ${unitLabel(s.unit)}`).join(" · ")})` : ", and none are set yet"}.
        </p>
      ) : <p className="mt-1 text-xs text-slate-400">Applies on every course and in every role, unless a course rate below says otherwise.</p>}
      <ul className="mt-3 space-y-1.5">
        {extraKeys.map((ck) => {
          const x = parseKey(ck);
          const what = x.courseTypeId ? `On ${courseName(x.courseTypeId)}` : `As ${roleName(x.roleTypeId)}`;
          return (
            <li key={ck} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">{what}</span>
              <AmountUnit value={d.get(ck)} onChange={(v) => d.set(ck, v)} currency={currency} label={what} />
              <button type="button" onClick={() => d.drop(ck)} className="text-xs text-slate-400 hover:text-port">Remove</button>
            </li>
          );
        })}
        <li><AddCourseRate label="+ Different rate on a course" courses={courses} taken={new Set(extraKeys.map((x) => parseKey(x).courseTypeId).filter((x): x is string => Boolean(x)))} onAdd={(cid) => d.set(keyOf({ instructorId: person.id, roleTypeId: null, courseTypeId: cid }), { amount: "", unit: d.get(k).unit })} /></li>
      </ul>
      <SaveBar count={d.changes.length} invalid={d.invalid} pending={pending} msg={msg} onSave={save} onReset={d.reset} />
    </div>
  );
}
