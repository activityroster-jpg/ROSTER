"use client";

import { FreeTextHint } from "@/components/FreeTextHint";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anonymiseInstructorAction, setRestrictionAction } from "@/app/(app)/office/staff/actions";

/** Export, restrict and anonymise one person: the tools behind a data request. */
export function PersonDataTools({ instructorId, name, restricted, restrictedReason, anonymised }: { instructorId: string; name: string; restricted: boolean; restrictedReason: string | null; anonymised: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState(restrictedReason ?? "");
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Done" : r.error ?? "Failed" });
    if (r.ok) router.refresh();
  });

  if (anonymised) {
    return <p className="text-sm text-slate-500">This record was anonymised. Only roster and payroll history remain, with no identifying details.</p>;
  }
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium text-navy">Copy of their data</p>
        <p className="text-xs text-slate-500">Everything this centre holds about {name}: profile, contacts, certs and checks, assignments, availability, hours, leave, pay rates, notifications, change-log entries and sign-ins. Each download is recorded.</p>
        <div className="mt-1.5 flex gap-2">
          <a href={`/api/office/staff/${instructorId}/export`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50">Download JSON</a>
          <a href={`/api/office/staff/${instructorId}/export?format=csv`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50">Download CSV</a>
        </div>
      </div>
      <div>
        <p className="font-medium text-navy">Restrict processing {restricted ? <span className="ml-1 rounded-full bg-port/10 px-2 py-0.5 text-[10px] font-semibold text-port">Restricted</span> : null}</p>
        <p className="text-xs text-slate-500">Keeps their record but stops it being used: they cannot be rostered and receive no notifications until lifted. Use it while a dispute or correction is being sorted out.</p>
        {restricted ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">Reason: {restrictedReason || "—"}</span>
            <button disabled={pending} onClick={() => run(() => setRestrictionAction(instructorId, false, ""))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50">Lift restriction</button>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (goes in the change log)" aria-label="Reason for restriction" className="w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <button disabled={pending} onClick={() => run(() => setRestrictionAction(instructorId, true, reason))} className="rounded-lg border border-port/40 px-3 py-1.5 text-xs font-medium text-port hover:bg-port/5">Restrict</button>
            <FreeTextHint className="basis-full" />
          </div>
        )}
      </div>
      <div>
        <p className="font-medium text-navy">Anonymise (right to erasure)</p>
        <p className="text-xs text-slate-500">Removes their name, contact details, date of birth, guardian and emergency contacts, certificates and checks with their files, availability, leave, pay rates and notifications, and their login to this centre. Roster and payroll history stays as “Former staff member” so your records still add up. This cannot be undone, and it is re-applied automatically if the database is ever restored from a backup.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={`Type “${name}” to confirm`} className="w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <button disabled={pending || typed.trim().toLowerCase() !== name.trim().toLowerCase()} onClick={() => { if (confirm(`Anonymise ${name}? This cannot be undone.`)) run(() => anonymiseInstructorAction(instructorId, typed)); }} className="rounded-lg bg-port px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Anonymise</button>
        </div>
      </div>
      {msg ? <p className={msg.ok ? "text-starboard" : "text-port"}>{msg.text}</p> : null}
    </div>
  );
}
