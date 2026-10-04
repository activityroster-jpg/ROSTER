"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMyDetailsAction } from "@/app/(app)/portal/settings/actions";

function under18(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const b = new Date(`${dob}T00:00:00Z`); const n = new Date();
  let age = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) age -= 1;
  return age < 18;
}

/**
 * Date of birth, and for an under-18 a parent or guardian to invite. The
 * parent gets their own small account to approve the young person working
 * here (Conor, 4 Oct 2026). Shown on the welcome page until answered, and
 * under Settings afterwards.
 */
export function DetailsCard({ dateOfBirth, parentInvited, approvalRequired }: { dateOfBirth: string | null; parentInvited: boolean; approvalRequired: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dob, setDob] = useState(dateOfBirth ?? "");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const young = under18(dob);
  const needParent = young && !parentInvited;
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setMyDetailsAction({ dateOfBirth: dob, parentName: pName, parentEmail: pEmail }); setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error ?? "Could not save" }); if (r.ok) router.refresh(); }); }}
      className="space-y-3"
    >
      <label className="block text-xs font-medium text-slate-500">Date of birth
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required className={`mt-1 ${field} max-w-xs`} />
        <span className="mt-1 block font-normal text-slate-400">Your centre needs this for the rules on young people&rsquo;s working hours. Only your centre sees it.</span>
      </label>
      {young ? (
        parentInvited ? (
          <p className="rounded-lg bg-teal/5 px-3 py-2 text-xs text-slate-600">Your parent or guardian has been invited to approve you working here. {approvalRequired ? "You can be rostered once they approve." : "Your centre doesn't require their approval before rostering you."}</p>
        ) : (
          <div className="rounded-lg border border-amber/40 bg-amber/5 p-3">
            <p className="text-xs font-medium text-navy">You&rsquo;re under 18, so we&rsquo;ll ask a parent or guardian to approve you working here.</p>
            <p className="mb-2 text-xs text-slate-500">They get an email with a link to a small account where they can approve or decline, and see your roster. Nothing else about you is shared with them.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Parent or guardian's name" required={needParent} className={field} />
              <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} type="email" placeholder="Their email" required={needParent} className={field} />
            </div>
          </div>
        )
      ) : null}
      <div className="flex items-center gap-3">
        <button disabled={pending || !dob} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : needParent ? "Save and invite my parent" : "Save"}</button>
        {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
