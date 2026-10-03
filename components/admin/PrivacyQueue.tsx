"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPrivacyRequestStatusAction } from "@/app/admin/privacy/actions";

export interface PrivacyRow { id: string; kind: string; name: string; email: string; centre: string | null; message: string; status: string; dueAt: string; createdAt: string; acknowledgedAt: string | null; notes: string | null }

const KIND: Record<string, string> = { access: "Copy of data", correction: "Correction", erasure: "Deletion", restriction: "Restriction", portability: "Export", objection: "Objection", complaint: "Complaint", other: "Other" };
const STATUS: Record<string, string> = { new: "New", acknowledged: "Acknowledged", in_progress: "In progress", closed: "Closed" };

export function PrivacyQueue({ rows }: { rows: PrivacyRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = (id: string, status: string) => start(async () => { await setPrivacyRequestStatusAction(id, status, notes[id]); router.refresh(); });
  const days = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return (
    <ul className="space-y-2">
      {rows.length === 0 ? <li className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No requests. The public form is at /privacy-request.</li> : null}
      {rows.map((r) => {
        const left = days(r.dueAt);
        const open = r.status !== "closed";
        return (
          <li key={r.id} className="rounded-card border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "closed" ? "bg-slate-100 text-slate-500" : r.status === "new" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>{STATUS[r.status] ?? r.status}</span>
              <span className="font-semibold text-navy">{KIND[r.kind] ?? r.kind}</span>
              <span className="text-slate-600">{r.name} &lt;{r.email}&gt;{r.centre ? ` · ${r.centre}` : ""}</span>
              <span className="ml-auto text-xs text-slate-400">ref {r.id.slice(0, 8).toUpperCase()} · {new Date(r.createdAt).toLocaleDateString("en-GB")}</span>
              {open ? <span className={`text-xs font-semibold ${left <= 5 ? "text-port" : "text-slate-500"}`}>{left >= 0 ? `${left} day${left === 1 ? "" : "s"} left` : `${-left} day${left === -1 ? "" : "s"} overdue`}</span> : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.message}</p>
            {open ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={notes[r.id] ?? r.notes ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="Notes (what you did, who you passed it to)" className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                {r.status === "new" ? <button disabled={pending} onClick={() => act(r.id, "acknowledged")} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Mark acknowledged</button> : null}
                {r.status !== "in_progress" ? <button disabled={pending} onClick={() => act(r.id, "in_progress")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-50">In progress</button> : null}
                <button disabled={pending} onClick={() => act(r.id, "closed")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-50">Close</button>
              </div>
            ) : r.notes ? <p className="mt-2 text-xs text-slate-500">Notes: {r.notes}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
