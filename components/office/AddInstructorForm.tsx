"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";
import { addDefaultGradesAction, addQualificationTypeAction } from "@/app/(app)/office/onboarding/actions";

const initial: ActionState = { ok: false };

export interface QualChoice { id: string; name: string }

export function AddInstructorForm({ quals }: { quals: QualChoice[] }) {
  const [state, action, pending] = useActionState(createInstructorAction, initial);
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [newType, setNewType] = useState("");

  const addType = () => {
    const name = newType.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await addQualificationTypeAction({ name });
      if (res.ok) { setNewType(""); router.refresh(); }
    });
  };
  const addAll = () => startTransition(async () => { await addDefaultGradesAction(); router.refresh(); });

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
          <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
          <input name="email" type="email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Employment</label>
          <select name="employmentType" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="employed">Employed</option>
            <option value="freelance">Freelance</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-500">Qualifications / instructor type they hold</label>
          <button type="button" onClick={addAll} disabled={busy} className="text-xs font-semibold text-teal hover:underline disabled:opacity-50">+ Add all RYA types</button>
        </div>
        {quals.length > 0 ? (
          <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            {quals.map((q) => (
              <label key={q.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="qual" value={q.id} className="h-4 w-4 rounded border-slate-300 text-teal focus:ring-teal" />
                {q.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">No types yet — add one below or click &ldquo;Add all RYA types&rdquo;.</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
            placeholder="Add another type / job role…"
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-teal"
          />
          <button type="button" onClick={addType} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">+ Add type</button>
        </div>
        <p className="mt-1 text-xs text-slate-400">The courses they&apos;re approved to run are worked out from these against each course&apos;s requirements.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add instructor"}
        </button>
        {state.error ? <p className="text-sm text-port">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-starboard">Instructor added.</p> : null}
      </div>
    </form>
  );
}
