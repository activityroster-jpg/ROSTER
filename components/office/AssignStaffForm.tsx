"use client";

import { useActionState, useState } from "react";
import { assignStaffAction, type ActionState } from "@/app/(app)/office/courses/actions";
import { courseAvailLabel, type CourseAvailState } from "@/lib/domain/availability";

const initial: ActionState = { ok: false };

export function AssignStaffForm({
  courseId,
  instructors,
  roles,
}: {
  courseId: string;
  instructors: { id: string; name: string; fit: boolean; reason?: string; avail?: CourseAvailState; qualified?: boolean | null }[];
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignStaffAction, initial);
  const [override, setOverride] = useState(false);
  const [chosen, setChosen] = useState("");

  const availLabel = (a?: CourseAvailState) => (a ? courseAvailLabel(a) : "");
  const selected = instructors.find((i) => i.id === chosen);
  const availWarn = selected && (selected.avail === "unavailable" || selected.avail === "silent" || selected.avail === "unset" || selected.avail === "partial");
  const warnText = selected?.avail === "unavailable" ? "said they're busy" : selected?.avail === "silent" ? "hasn't marked themselves free yet, so they count as busy" : selected?.avail === "partial" ? "is only partly free" : "hasn't been asked about these dates yet (beyond the availability window)";

  return (
    <form action={action} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <input type="hidden" name="courseId" value={courseId} />
      <select aria-label="Instructor" name="instructorId" required value={chosen} onChange={(e) => setChosen(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal">
        <option value="">Instructor…</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {i.fit ? "" : ` — ${i.reason || "not cleared"}`}
            {i.qualified === false ? " — not qualified for this type" : ""}
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
        Assign anyway (override checks)
      </label>
      {selected?.qualified === false ? (
        <p className="sm:col-span-2 rounded-lg bg-port/10 px-2.5 py-1.5 text-xs text-navy">
          ✕ {selected.name}&apos;s recorded qualifications don&apos;t cover this course type. Assigning them needs an override; or update their qualifications on the Instructors tab.
        </p>
      ) : null}
      {availWarn ? (
        <p className="sm:col-span-2 rounded-lg bg-amber/10 px-2.5 py-1.5 text-xs text-navy">
          ⚠ {selected!.name} {warnText} for this course&apos;s times — you can still assign them{selected!.avail === "unset" ? <>, or <a href="/office/settings#availability-window" className="text-teal hover:underline">lengthen the window</a> so they&apos;re asked</> : null}.
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
