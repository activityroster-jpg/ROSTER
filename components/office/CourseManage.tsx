"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelCourseAction, deleteCourseAction, renameCourseAction, restoreSessionAction, setCourseStatusAction } from "@/app/(app)/office/courses/actions";
import { CancelPanel, type CancelChoice } from "./CancelPanel";

const STATUSES = ["draft", "scheduled", "confirmed", "completed"];

export function CourseManage({ id, name, status, liveSessions, staffCount, canDelete, deleteBlockedBecause, cancelReason }: {
  id: string; name: string; status: string;
  /** Sessions not yet cancelled. */
  liveSessions: number;
  /** People rostered (not declined): how many a cancellation tells. */
  staffCount: number;
  canDelete: boolean;
  deleteBlockedBecause?: string | null;
  cancelReason?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [nm, setNm] = useState(name);
  const [cancelling, setCancelling] = useState(false);
  const cancelled = status === "cancelled";

  const rename = () => start(async () => { const r = await renameCourseAction(id, nm); setMsg(r.ok ? "Saved" : r.error ?? "Failed"); router.refresh(); });
  const setStatus = (s: string) => start(async () => { const r = await setCourseStatusAction(id, s); setMsg(r.ok ? null : r.error ?? "Failed"); router.refresh(); });
  const del = () => {
    if (!confirm("Delete this draft course and its sessions? Nobody is rostered on it. This can't be undone.")) return;
    start(async () => { const r = await deleteCourseAction(id); if (r.ok) router.push("/office/courses"); else setMsg(r.error ?? "Failed"); });
  };
  const cancel = (c: CancelChoice) => start(async () => {
    const r = await cancelCourseAction(id, c);
    setMsg(r.ok ? r.message ?? "Cancelled" : r.error ?? "Failed");
    if (r.ok) setCancelling(false);
    router.refresh();
  });
  const restore = () => start(async () => { const r = await restoreSessionAction(id, null); setMsg(r.ok ? r.message ?? "Restored" : r.error ?? "Failed"); router.refresh(); });

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div>
      {cancelled ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-port/30 bg-port/5 px-3 py-2">
          <p className="text-sm text-port"><span className="font-semibold">Cancelled.</span>{cancelReason ? ` ${cancelReason}` : ""} It&rsquo;s off the roster and the app; the people on it were told.</p>
          <button onClick={restore} disabled={pending} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Restore course</button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">Course name
          <div className="mt-1 flex gap-2">
            <input value={nm} onChange={(e) => setNm(e.target.value)} className={`w-full ${field}`} />
            <button onClick={rename} disabled={pending} className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Save</button>
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-500">Status
          <select value={cancelled ? "cancelled" : status} onChange={(e) => setStatus(e.target.value)} disabled={pending || cancelled} className={`mt-1 block w-full capitalize ${field} disabled:bg-slate-50`}>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            {cancelled ? <option value="cancelled">cancelled</option> : null}
          </select>
          {!cancelled ? <span className="mt-1 block font-normal text-slate-400">To cancel, use the button below so everyone is told.</span> : null}
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
          {msg ? <span className="text-sm text-slate-500">{msg}</span> : <span />}
          <div className="flex flex-wrap items-center gap-2">
            {!cancelled && liveSessions > 0 ? (
              <button onClick={() => setCancelling((v) => !v)} disabled={pending} className="rounded-lg border border-port/40 px-4 py-2 text-sm font-semibold text-port hover:bg-port/5 disabled:opacity-50">Cancel course…</button>
            ) : null}
            {canDelete ? (
              <button onClick={del} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">Delete draft</button>
            ) : (
              <span className="text-xs text-slate-400" title={deleteBlockedBecause ?? undefined}>Can&rsquo;t be deleted{deleteBlockedBecause ? `: ${deleteBlockedBecause.replace(/\. Cancel it instead.*$/, "")}` : ""}. Cancel it instead.</span>
            )}
          </div>
        </div>
      </div>
      {cancelling ? (
        <CancelPanel what={liveSessions === 1 ? "the whole course (1 remaining day)" : `the whole course (${liveSessions} remaining days)`} people={staffCount} pending={pending} onConfirm={cancel} onClose={() => setCancelling(false)} />
      ) : null}
    </div>
  );
}
