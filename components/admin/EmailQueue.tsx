"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { discardEmailAction, retryEmailAction } from "@/app/admin/email/actions";

export interface OutboxRow { id: string; status: string; stream: string; to: string; subject: string; attempts: number; lastError: string | null; nextAttemptAt: string | null; updatedAt: string; retryable: boolean }

export function EmailQueue({ rows }: { rows: OutboxRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Failed"); router.refresh(); });
  if (rows.length === 0) return <p className="rounded-card border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing waiting and nothing failed.</p>;
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
      {msg ? <p className="px-4 pt-3 text-xs text-navy">{msg}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Status</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Last error</th><th className="px-3 py-2">Next / updated</th><th className="px-3 py-2"></th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "failed" ? "bg-port/10 text-port" : "bg-amber-50 text-amber-700"}`}>{r.status}</span><span className="ml-1 text-[10px] text-slate-400">{r.stream}</span></td>
              <td className="px-3 py-2 text-slate-700">{r.to}</td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-700" title={r.subject}>{r.subject}</td>
              <td className="px-3 py-2 text-slate-600">{r.attempts}</td>
              <td className="max-w-sm px-3 py-2 text-xs text-slate-500">{r.lastError ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{r.status === "queued" && r.nextAttemptAt ? `retry ${new Date(r.nextAttemptAt).toLocaleString("en-GB")}` : new Date(r.updatedAt).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-right">
                {r.retryable ? <button disabled={pending} onClick={() => run(() => retryEmailAction(r.id))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-navy hover:bg-slate-50">Retry now</button> : null}
                {r.status === "queued" ? <button disabled={pending} onClick={() => run(() => discardEmailAction(r.id))} className="ml-1 rounded-lg border border-port/40 px-2 py-1 text-xs text-port hover:bg-port/5">Discard</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
