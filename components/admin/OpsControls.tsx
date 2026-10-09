"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIncidentAction, setMaintenanceAction } from "@/app/admin/actions";

export function OpsControls({ incident, maintenance }: { incident: { message: string; level: "info" | "warn" } | null; maintenance: { on: boolean; message: string } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(incident?.message ?? "");
  const [level, setLevel] = useState<"info" | "warn">(incident?.level ?? "info");
  const [mMsg, setMMsg] = useState(maintenance?.message ?? "");
  const [note, setNote] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); setNote(r.ok ? "Saved" : r.error ?? "Failed"); router.refresh(); });
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div>
        <p className="font-semibold text-navy">Incident banner {incident?.message ? <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">showing</span> : null}</p>
        <p className="mb-2 text-xs text-slate-500">One line shown at the top of every page (website, office and app) with a link to the status page. Clear it when the incident is over.</p>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Emails are delayed; we are working on it." className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value as "info" | "warn")} className="rounded-lg border border-slate-300 px-2 py-1 text-xs"><option value="info">Information (blue)</option><option value="warn">Problem (red)</option></select>
          <button disabled={pending || !msg.trim()} onClick={() => run(() => setIncidentAction(msg, level))} className="rounded-lg bg-teal px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Show banner</button>
          {incident?.message ? <button disabled={pending} onClick={() => run(() => setIncidentAction("", level))} className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-navy">Clear</button> : null}
        </div>
      </div>
      <div>
        <p className="font-semibold text-navy">Maintenance mode {maintenance?.on ? <span className="ml-1 rounded-full bg-port/10 px-2 py-0.5 text-[10px] font-semibold text-port">ON</span> : null}</p>
        <p className="mb-2 text-xs text-slate-500">Replaces the office and the instructor app with a &ldquo;back shortly&rdquo; page for everyone except platform admins. The website and the status page stay up. Use it while fixing a data problem so nobody edits mid-repair.</p>
        <input value={mMsg} onChange={(e) => setMMsg(e.target.value)} placeholder="Optional message, e.g. Back by 14:30." className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {maintenance?.on
            ? <button disabled={pending} onClick={() => run(() => setMaintenanceAction(false, mMsg))} className="rounded-lg bg-starboard px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Switch maintenance off</button>
            : <button disabled={pending} onClick={async () => { if (await askConfirm("Put every centre into maintenance mode now?")) run(() => setMaintenanceAction(true, mMsg)); }} className="rounded-lg bg-port px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Switch maintenance on</button>}
        </div>
      </div>
      {note ? <p className="text-xs text-slate-500 md:col-span-2">{note}</p> : null}
    </div>
  );
}
