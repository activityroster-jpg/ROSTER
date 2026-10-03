"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreCourseTypesAction } from "@/app/(app)/office/course-setup/actions";

/** Shown on the Courses page when no course types are on the list. */
export function RestoreCourseTypes() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const restore = () => start(async () => {
    const r = await restoreCourseTypesAction();
    setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Could not restore");
    router.refresh();
  });
  return (
    <div className="mb-6 rounded-card border border-amber/50 bg-amber/10 p-4">
      <p className="font-semibold text-navy">Your course list is empty</p>
      <p className="mt-1 text-sm text-slate-600">Nothing is ticked as a course you run, so there is nothing to pick when you add a course. Bring back the RYA course list, or add your own on Course setup.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={restore} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Restoring…" : "Restore RYA courses"}</button>
        <a href="/office/course-setup" className="text-sm font-medium text-teal hover:underline">Add my own →</a>
        {msg ? <span className="text-sm text-slate-500" role="status">{msg}</span> : null}
      </div>
    </div>
  );
}
