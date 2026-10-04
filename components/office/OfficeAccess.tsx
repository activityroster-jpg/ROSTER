"use client";

import { ConfirmDialog } from "./ConfirmDialog";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteOfficeAdminAction, removeOfficeAccessAction, setOfficeFeaturesAction } from "@/app/(app)/office/staff/access-actions";
import { FEATURE_LABEL, OFFICE_FEATURES, type OfficeFeature } from "@/lib/auth/rbac";

export interface OfficeMemberRow { userId: string; name: string; email: string; role: "owner" | "admin"; status: string; features: OfficeFeature[] }

/**
 * Who can open the office, and what each office admin can reach. The
 * superadmin edits; office admins only see the list.
 */
export function OfficeAccess({ members, isOwner, meId }: { members: OfficeMemberRow[]; isOwner: boolean; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<OfficeFeature[]>([]);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Failed"); if (r.ok) { setInviting(false); setName(""); setEmail(""); setPicked([]); } router.refresh(); });
  const toggle = (list: OfficeFeature[], f: OfficeFeature) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]);
  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div className="text-sm">
      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.userId} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-navy">{m.name || m.email}{m.userId === meId ? <span className="ml-1 text-xs font-normal text-slate-400">(you)</span> : null}</p>
                <p className="text-xs text-slate-500">{m.email} · {m.role === "owner" ? "Superadmin" : "Office admin"}{m.status === "invited" ? " · invited, not signed in yet" : ""}</p>
              </div>
              {isOwner && m.role === "admin" ? (
                <button type="button" disabled={pending} onClick={() => setRemoving({ userId: m.userId, name: m.name || m.email })} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">Remove office access</button>
              ) : null}
            </div>
            {m.role === "owner" ? (
              <p className="mt-1 text-xs text-slate-500">Can do everything. To hand this to someone else, contact ActivityRoster support.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {OFFICE_FEATURES.map((f) => (
                  <label key={f} className={`flex items-center gap-1.5 text-xs ${isOwner ? "cursor-pointer" : ""} ${m.features.includes(f) ? "text-navy" : "text-slate-400"}`} title={FEATURE_LABEL[f].hint}>
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300" checked={m.features.includes(f)} disabled={!isOwner || pending}
                      onChange={() => run(() => setOfficeFeaturesAction(m.userId, toggle(m.features, f)))} />
                    {FEATURE_LABEL[f].label}
                  </label>
                ))}
                {m.features.length === 0 ? <span className="text-xs text-amber">Nothing ticked yet: they can open the office but see no pages.</span> : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        inviting ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-navy">Invite an office admin</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={field} />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">What they can reach (you can change this any time)</p>
            <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
              {OFFICE_FEATURES.map((f) => (
                <label key={f} className="flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300" checked={picked.includes(f)} onChange={() => setPicked((p) => toggle(p, f))} />
                  <span><span className="font-medium text-navy">{FEATURE_LABEL[f].label}</span> <span className="text-slate-500">{FEATURE_LABEL[f].hint}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={pending || !name.trim() || !email.trim()} onClick={() => run(() => inviteOfficeAdminAction({ name, email, features: picked }))} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Sending…" : "Send invite"}</button>
              <button type="button" onClick={() => setInviting(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-white">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setInviting(true)} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">+ Invite an office admin</button>
        )
      ) : null}
      {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
      <ConfirmDialog open={removing !== null} title={`Remove ${removing?.name ?? ""}'s office access?`} confirmLabel="Remove access" busy={pending} onCancel={() => setRemoving(null)}
        onConfirm={() => { const u = removing; setRemoving(null); if (u) run(() => removeOfficeAccessAction(u.userId)); }}
        consequences={["They can no longer open the office on any device.", "If they are also an instructor they keep the app and their roster.", "Their past changes stay in the change log under their name."]} />
    </div>
  );
}
