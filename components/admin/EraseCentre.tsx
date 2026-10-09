"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eraseCentreAction, replayDeletionsAction } from "@/app/admin/actions";

/**
 * The last step of a centre leaving. Only active once the 90-day export
 * window has closed; the slug must be typed. Everything else (confirmation
 * emails, the reminder) is automatic — see lib/services/leaving.
 */
export function EraseCentre({ id, slug, status, deadline }: { id: string; slug: string; status: string; deadline: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const leaving = status === "suspended" || status === "cancelled";
  const open = leaving && deadline !== null && new Date(deadline).getTime() <= Date.now();
  const run = () => start(async () => {
    if (!await askConfirm(`Permanently erase ${slug} and every record it holds? This cannot be undone.`)) return;
    const r = await eraseCentreAction(id, typed);
    setMsg(r.ok ? "Erased. The centre's former admins have been emailed." : r.error ?? "Failed");
    if (r.ok) router.push("/admin");
  });
  const [replayMsg, setReplayMsg] = useState<string | null>(null);
  const replay = () => start(async () => {
    const r = await replayDeletionsAction(id);
    setReplayMsg(r.ok ? `Checked ${r.checked ?? 0} past anonymisation${(r.checked ?? 0) === 1 ? "" : "s"}; re-applied ${r.reapplied ?? 0}.` : r.error ?? "Failed");
  });
  return (
    <div className="mt-4 rounded-lg border border-port/30 bg-port/5 p-3 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-port/20 pb-3">
        <span className="font-semibold text-navy">After a restore from backup</span>
        <button disabled={pending} onClick={replay} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Replay deletions</button>
        <span className="text-xs text-slate-500">Re-anonymises anyone this centre erased who has come back with a restore. Safe to run any time.</span>
        {replayMsg ? <span className="w-full text-xs text-navy">{replayMsg}</span> : null}
      </div>
      <p className="font-semibold text-port">Leaving</p>
      {!leaving ? (
        <p className="mt-1 text-xs text-slate-500">Set the status to <strong>suspended</strong> or <strong>cancelled</strong> when a centre leaves. Its admins are emailed a confirmation with a 90-day export window and a reminder 14 days before it closes; you are emailed when the window has closed.</p>
      ) : !open ? (
        <p className="mt-1 text-xs text-slate-500">Export window open until <strong>{deadline ? new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "90 days after the status change"}</strong>. Erasure is offered after that.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-slate-600">The export window closed on {new Date(deadline!).toLocaleDateString("en-GB")}. Type <code>{slug}</code> to erase this centre and all its data permanently.</p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={slug} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
          <button disabled={pending || typed.trim() !== slug} onClick={run} className="rounded-lg bg-port px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">{pending ? "Erasing…" : "Erase this centre"}</button>
        </div>
      )}
      {msg ? <p className="mt-2 text-xs text-navy">{msg}</p> : null}
    </div>
  );
}
