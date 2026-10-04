"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transferOwnerAction } from "@/app/admin/actions";

export interface OfficeUserRow { userId: string; name: string; email: string; role: string; status: string }

/** Dev Center: who the superadmin is, and the transfer to another office user. */
export function TransferOwner({ id, members }: { id: string; members: OfficeUserRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const owner = members.find((m) => m.role === "owner");
  const admins = members.filter((m) => m.role === "admin");
  return (
    <div className="text-sm">
      <p className="text-slate-700"><span className="font-medium text-navy">{owner ? `${owner.name || owner.email} (${owner.email})` : "No superadmin on record"}</span></p>
      <p className="mt-0.5 text-xs text-slate-500">Office admins: {admins.length ? admins.map((a) => `${a.name || a.email}${a.status === "invited" ? " (invited)" : ""}`).join(", ") : "none"}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">Transfer superadmin to
          <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Choose an office admin…</option>
            {admins.map((a) => <option key={a.userId} value={a.email}>{a.name || a.email} · {a.email}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !to}
          onClick={() => { if (!confirm(`Make ${to} the superadmin? The current superadmin becomes an office admin with full access. Both are emailed.`)) return; start(async () => { const r = await transferOwnerAction(id, to); setMsg(r.ok ? "Transferred" : r.error ?? "Failed"); router.refresh(); }); }}
          className="rounded-lg border border-port/40 px-3 py-2 text-sm font-semibold text-port hover:bg-port/5 disabled:opacity-50"
        >
          {pending ? "Transferring…" : "Transfer"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">Only for a written request from the current superadmin (or proof the account is lost). The person must already be an office admin of the centre.</p>
      {msg ? <p className="mt-1 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
