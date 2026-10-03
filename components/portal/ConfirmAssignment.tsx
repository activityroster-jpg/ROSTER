"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmAssignmentAction, declineAssignmentAction } from "@/app/(app)/portal/actions";

/** Confirm / can't-make-it controls for one rostered course. */
export function ConfirmAssignment({ assignmentId, status, declineNote }: {
  assignmentId: string;
  status: "assigned" | "confirmed" | "declined";
  declineNote?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const confirm = () => start(async () => {
    setErr(null);
    const r = await confirmAssignmentAction(assignmentId);
    if (!r.ok) setErr(r.error ?? "Could not confirm");
    else { setDeclining(false); router.refresh(); }
  });
  const decline = () => start(async () => {
    setErr(null);
    const r = await declineAssignmentAction(assignmentId, note);
    if (!r.ok) setErr(r.error ?? "Could not send");
    else { setDeclining(false); setNote(""); router.refresh(); }
  });

  if (declining) {
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <label className="block text-xs font-medium text-slate-600">
          Tell your centre why, so they can find cover
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Away that weekend" className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-navy" />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={decline} disabled={pending || note.trim().length < 2} className="rounded-lg bg-port px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Send"}</button>
          <button type="button" onClick={() => { setDeclining(false); setErr(null); }} className="text-sm text-slate-500">Cancel</button>
        </div>
        {err ? <p className="mt-1 text-xs text-port">{err}</p> : null}
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-starboard">✓ Confirmed</span>
        <button type="button" onClick={() => setDeclining(true)} className="text-slate-400 hover:text-port">Can&apos;t make it after all?</button>
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="mt-2 text-xs">
        <p className="font-semibold text-port">You said you can&apos;t make it{declineNote ? ` — “${declineNote}”` : ""}. Your centre has been told.</p>
        <button type="button" onClick={confirm} disabled={pending} className="mt-1 font-semibold text-teal disabled:opacity-50">Actually, I can make it</button>
        {err ? <p className="mt-1 text-port">{err}</p> : null}
      </div>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" onClick={confirm} disabled={pending} className="flex-1 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "✓ I'll be there"}</button>
        <button type="button" onClick={() => setDeclining(true)} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Can&apos;t make it</button>
      </div>
      {err ? <p className="mt-1 text-xs text-port">{err}</p> : null}
    </div>
  );
}
