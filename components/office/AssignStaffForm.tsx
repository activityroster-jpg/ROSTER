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
  instructors: { id: string; name: string; fit: boolean; reason?: string; avail?: "available" | "unavailable" | "partial" | "unset" | "none" }[];
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignStaffAction, initial);
  const [override, setOverride] = useState(false);
  const [chosen, setChosen] = useState("");

  const availLabel = (a?: string) =>
    a === "available" ? "✓ available" : a === "unavailable" ? "✕ not available" : a === "partial" ? "~ partly available" : a === "unset" ? "availability not set" : "";
  const selected = instructors.find((i) => i.id === chosen);
  const availWarn = selected && (selected.avail === "unavailable" || selected.avail === "unset" || selected.avail === "partial");

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <input type="hidden" name="courseId" value={courseId} />
      <select aria-label="Instructor" name="instructorId" required value={chosen} onChange={(e) => setChosen(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Instructor…</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {i.fit ? "" : ` — ${i.reason || "not cleared"}`}
            {i.avail && i.avail !== "none" ? ` · ${availLabel(i.avail)}` : ""}
          </option>
        ))}
      </select>
      <select aria-label="Role" name="roleTypeId" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Role…</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="override" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        Assign anyway despite the gap (records why)
      </label>
      <input
        name="overrideNote"
        placeholder="Override reason"
        disabled={!override}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal disabled:bg-slate-100"
      />
      {availWarn ? (
        <p className="sm:col-span-2 rounded-lg bg-amber/10 px-2.5 py-1.5 text-xs text-navy">
          ⚠ {selected!.name} {selected!.avail === "unavailable" ? "said they're not available" : selected!.avail === "partial" ? "is only partly available" : "hasn't set availability"} for this course&apos;s times — you can still assign them.
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Assigning…" : "Assign"}
        </button>
        {state.error ? <span role="alert" className="ml-3 text-sm text-port">{state.error}</span> : null}
        {state.ok ? <span role="status" className="ml-3 text-sm text-starboard">{state.message}</span> : null}
      </div>
    </form>
  );
}
