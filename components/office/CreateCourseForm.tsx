"use client";

import { useActionState } from "react";
import { createCourseAction, type ActionState } from "@/app/(app)/office/courses/actions";

const initial: ActionState = { ok: false };

export interface CourseTypeChoice { id: string; name: string; audience: "youth" | "adult" | "all" }

const GROUPS: { key: CourseTypeChoice["audience"]; label: string }[] = [
  { key: "youth", label: "Youth" },
  { key: "adult", label: "Adult" },
  { key: "all", label: "All ages" },
];

export function CreateCourseForm({ courseTypes, slotStyle = "slots" }: { courseTypes: CourseTypeChoice[]; slotStyle?: "slots" | "times" }) {
  const [state, action, pending] = useActionState(createCourseAction, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-500">Course type</label>
        <select name="courseTypeId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
          <option value="">Select…</option>
          {GROUPS.filter((g) => courseTypes.some((c) => c.audience === g.key)).map((g) => (
            <optgroup key={g.key} label={g.label}>
              {courseTypes.filter((c) => c.audience === g.key).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
        <input name="date" type="date" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
      </div>

      {slotStyle === "times" ? (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Start</label>
            <input name="startTime" type="time" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">End</label>
            <input name="endTime" type="time" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slot</label>
          <select name="slot" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal">
            <option value="AM">Morning (AM)</option>
            <option value="PM">Afternoon (PM)</option>
            <option value="EV">Evening (EV)</option>
          </select>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create course"}
        </button>
      </div>
      {state.error ? <p className="text-sm text-port sm:col-span-6">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-starboard sm:col-span-6">{state.message}</p> : null}
    </form>
  );
}
