"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInstructorStatusAction, updateInstructorAction } from "@/app/(app)/office/staff/actions";

/** Edit an instructor's basics, and mark them as having left (or bring them back). */
export function EditInstructorForm({ instructor }: { instructor: { id: string; name: string; email: string | null; phone: string | null; employmentType: string; status: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(instructor.name);
  const [email, setEmail] = useState(instructor.email ?? "");
  const [phone, setPhone] = useState(instructor.phone ?? "");
  const [employment, setEmployment] = useState(instructor.employmentType);
  const [msg, setMsg] = useState<string | null>(null);
  const left = instructor.status === "inactive";

  const save = () => start(async () => {
    const r = await updateInstructorAction(instructor.id, { name, email, phone, employmentType: employment });
    setMsg(r.ok ? "Saved" : r.error ?? "Could not save");
    if (r.ok) { setOpen(false); router.refresh(); }
  });
  const setStatus = (status: "active" | "inactive") => {
    const q = status === "inactive"
      ? `Mark ${instructor.name} as left? They disappear from rostering and lose app access; their history and hours stay.`
      : `Bring ${instructor.name} back? They can be rostered again and get their app access back.`;
    if (!confirm(q)) return;
    start(async () => { const r = await setInstructorStatusAction(instructor.id, status); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Could not update"); router.refresh(); });
  };
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {open ? (
        <div className="w-full rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-500">Full name<input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} /></label>
            <label className="text-xs font-medium text-slate-500">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${field}`} /></label>
            <label className="text-xs font-medium text-slate-500">Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 ${field}`} /></label>
            <label className="text-xs font-medium text-slate-500">Employment
              <select value={employment} onChange={(e) => setEmployment(e.target.value)} className={`mt-1 ${field}`}>
                <option value="employed">Employed</option><option value="freelance">Freelance</option><option value="volunteer">Volunteer</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={save} disabled={pending || !name.trim()} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-navy">Cancel</button>
            {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
          </div>
          <p className="mt-2 text-xs text-slate-400">Changing the email doesn&apos;t move their app login — re-send the invite afterwards if they use the app.</p>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Edit details</button>
          {left ? (
            <button type="button" disabled={pending} onClick={() => setStatus("active")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Bring back</button>
          ) : (
            <button type="button" disabled={pending} onClick={() => setStatus("inactive")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-port hover:text-port disabled:opacity-50">Mark as left</button>
          )}
          {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
        </>
      )}
    </div>
  );
}
