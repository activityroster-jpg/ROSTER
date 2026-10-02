"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveCoursesToTypeAction, setCourseTypeListedAction } from "@/app/(app)/office/course-setup/actions";

interface Item { id: string; name: string; courses: number }

/**
 * One-off course types — typed in manually or imported without a match. They
 * stay off the regular list; from here each can be added to the list, or its
 * courses moved under the right existing type.
 */
export function OneOffCourseTypes({ items, listed }: { items: Item[]; listed: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [target, setTarget] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Done" : res.error ?? "Something went wrong" });
      if (res.ok) router.refresh();
    });

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold text-navy">One-off course types</h2>
      <p className="mb-3 text-sm text-slate-500">
        Typed in manually or imported without a match — kept off your list. Add one to your list, or move its courses under the right type.
      </p>
      <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium text-navy">{it.name}</span>
            <span className="text-xs text-slate-400">{it.courses} course{it.courses === 1 ? "" : "s"}</span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => setCourseTypeListedAction(it.id, true))} className="rounded border border-teal px-2.5 py-1 text-xs font-semibold text-teal hover:bg-teal hover:text-white disabled:opacity-50">
                ＋ Add to list
              </button>
              {listed.length ? (
                <>
                  <select aria-label={`Move ${it.name} courses to`} value={target[it.id] ?? ""} onChange={(e) => setTarget((t) => ({ ...t, [it.id]: e.target.value }))} className="rounded border border-slate-300 px-2 py-1 text-xs">
                    <option value="">Move courses to…</option>
                    {listed.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button type="button" disabled={pending || !target[it.id]} onClick={() => run(() => moveCoursesToTypeAction(it.id, target[it.id]!))} className="rounded bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50">
                    Move
                  </button>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </section>
  );
}
