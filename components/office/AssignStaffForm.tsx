"use client";

import { useActionState, useState } from "react";
import { assignStaffAction, type ActionState } from "@/app/(app)/office/courses/actions";

const initial: ActionState = { ok: false };

export function AssignStaffForm({
  courseId,
  instructors,
  roles,
}: {
  courseId: string;
  instructors: { id: string; name: string; fit: boolean }[];
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignStaffAction, initial);
  const [override, setOverride] = useState(false);

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <input type="hidden" name="courseId" value={courseId} />
      <select name="instructorId" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Instructor…</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {i.fit ? "" : " ⚠ blocked"}
          </option>
        ))}
      </select>
      <select name="roleTypeId" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Role…</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="override" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        Override block (records a note)
      </label>
      <input
        name="overrideNote"
        placeholder="Override reason"
        disabled={!override}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal disabled:bg-slate-100"
      />
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Assigning…" : "Assign"}
        </button>
        {state.error ? <span className="ml-3 text-sm text-port">{state.error}</span> : null}
        {state.ok ? <span className="ml-3 text-sm text-starboard">{state.message}</span> : null}
      </div>
    </form>
  );
}
