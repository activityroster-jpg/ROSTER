"use client";

import { useCallback, useEffect, useState } from "react";
import { loadCourseEditorAction } from "@/app/(app)/office/courses/actions";
import type { CourseEditorData } from "@/lib/services/course-editor";
import { CourseCard } from "@/components/office/CourseCard";

/**
 * The editable box that opens when you click a session tile in a calendar. It
 * loads the course and renders the same CourseCard as the Courses page, already
 * expanded, so name, date/time, staff required and assignments are editable in
 * place. Reloads after each change so the box stays current.
 */
export function CourseEditorModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [data, setData] = useState<CourseEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const res = await loadCourseEditorAction(courseId);
    if (res.ok) { setData(res.data); setError(null); setVersion((v) => v + 1); }
    else setError(res.error);
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 pt-[10vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit course"
        className="w-full max-w-2xl rounded-card bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-navy">Edit course</h2>
          <div className="flex items-center gap-3">
            <a href={`/office/courses/${courseId}`} className="text-xs font-medium text-teal hover:underline">Full course page →</a>
            <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-navy" aria-label="Close">✕</button>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-port">{error}</p>
        ) : !data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <CourseCard key={version} {...data} defaultOpen onChanged={() => void load()} />
        )}
        <p className="mt-3 text-xs text-slate-400">Click the name or the date to change them; add or remove staff below. Changes save straight away.</p>
      </div>
    </div>
  );
}
