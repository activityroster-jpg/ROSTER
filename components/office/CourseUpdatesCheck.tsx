"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewIntegrationChangesAction, applyIntegrationChangesAction, type PreviewResult } from "@/app/(app)/office/integrations/actions";
import { providerInitials } from "@/lib/integrations/catalogue";
import type { FeedDiff } from "@/lib/services/integrations";

export interface ConnectedIntegration { id: string; provider: string; name: string; color: string }

/**
 * Compact "Check for updates" control for the Courses page, next to the
 * calendar. Pulls new/removed courses from the centre's connected booking
 * system(s) and lets the admin review and apply — the same flow as the
 * Integrations page, surfaced where the courses live.
 */
export function CourseUpdatesCheck({ integrations }: { integrations: ConnectedIntegration[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [diff, setDiff] = useState<FeedDiff | null>(null);
  const [addSel, setAddSel] = useState<Set<string>>(new Set());
  const [remSel, setRemSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (integrations.length === 0) return null;

  const check = (id: string) => {
    setMsg(null); setDiff(null); setActiveId(id);
    start(async () => {
      const res: PreviewResult = await previewIntegrationChangesAction(id);
      if (res.ok) {
        setDiff(res.diff);
        setAddSel(new Set(res.diff.toAdd.map((a) => a.key)));
        setRemSel(new Set());
      } else { setMsg({ ok: false, text: res.error }); setActiveId(null); }
    });
  };

  const apply = (id: string) => {
    start(async () => {
      const res = await applyIntegrationChangesAction(id, [...addSel], [...remSel]);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Done" : res.error ?? "Failed" });
      if (res.ok) { setActiveId(null); setDiff(null); router.refresh(); }
    });
  };

  const active = integrations.find((i) => i.id === activeId);

  return (
    <div className="mb-4 rounded-card border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">Booking system:</span>
        {integrations.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => check(i.id)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50"
          >
            <span aria-hidden style={{ backgroundColor: i.color }} className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white">{providerInitials(i.name)}</span>
            {pending && activeId === i.id ? "Checking…" : `Check ${i.name} for updates`}
          </button>
        ))}
      </div>

      {msg ? <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}

      {active && diff ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {diff.toAdd.length === 0 && diff.toRemove.length === 0 ? (
            <p className="text-sm text-slate-500">Everything&apos;s up to date — {diff.unchanged} course{diff.unchanged === 1 ? "" : "s"} already match {active.name}. Nothing to add or remove.</p>
          ) : (
            <div className="space-y-4">
              {diff.toAdd.length > 0 ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy">New in {active.name} <span className="font-normal text-slate-400">({diff.toAdd.length})</span></p>
                    <button type="button" onClick={() => setAddSel((s) => s.size === diff.toAdd.length ? new Set() : new Set(diff.toAdd.map((a) => a.key)))} className="text-xs font-medium text-teal hover:underline">{addSel.size === diff.toAdd.length ? "Deselect all" : "Select all"}</button>
                  </div>
                  <ul className="space-y-1">
                    {diff.toAdd.map((a) => (
                      <li key={a.key} className="flex items-center gap-2 rounded-lg bg-starboard/5 px-2 py-1.5 text-sm">
                        <input type="checkbox" checked={addSel.has(a.key)} onChange={() => setAddSel((s) => { const n = new Set(s); n.has(a.key) ? n.delete(a.key) : n.add(a.key); return n; })} />
                        <span className="font-medium text-navy">{a.name}</span>
                        <span className="text-xs text-slate-500">{a.date} · {a.slot}{a.startTime ? ` · ${a.startTime}` : ""}</span>
                        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ${a.audience === "youth" ? "bg-amber/15 text-amber" : a.audience === "adult" ? "bg-teal/15 text-teal" : "bg-slate-100 text-slate-500"}`}>{a.audience}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {diff.toRemove.length > 0 ? (
                <div>
                  <p className="mb-1 text-sm font-semibold text-navy">Removed from {active.name} <span className="font-normal text-slate-400">({diff.toRemove.length})</span></p>
                  <p className="mb-1 text-xs text-slate-500">These were imported before but are no longer in the feed. Tick to remove them here, or leave them to keep. Nothing is deleted unless you tick it.</p>
                  <ul className="space-y-1">
                    {diff.toRemove.map((r) => (
                      <li key={r.courseId} className="flex items-center gap-2 rounded-lg bg-port/5 px-2 py-1.5 text-sm">
                        <input type="checkbox" checked={remSel.has(r.courseId)} onChange={() => setRemSel((s) => { const n = new Set(s); n.has(r.courseId) ? n.delete(r.courseId) : n.add(r.courseId); return n; })} />
                        <span className="font-medium text-navy">{r.name}</span>
                        <span className="text-xs text-slate-500">{r.date} · {r.slot}</span>
                        <a href={`/office/courses/${r.courseId}`} className="ml-auto text-xs font-medium text-teal hover:underline">Edit</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => apply(active.id)} disabled={pending || (addSel.size === 0 && remSel.size === 0)} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">
                  {pending ? "Applying…" : `Apply — add ${addSel.size}, remove ${remSel.size}`}
                </button>
                <button type="button" onClick={() => { setActiveId(null); setDiff(null); }} className="text-sm text-slate-500 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
