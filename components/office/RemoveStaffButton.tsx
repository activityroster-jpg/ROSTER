"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeStaffAction } from "@/app/(app)/office/courses/actions";

export function RemoveStaffButton({ courseId, assignmentId }: { courseId: string; assignmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await removeStaffAction(courseId, assignmentId); router.refresh(); })}
      disabled={pending}
      className="text-xs text-slate-400 hover:text-port disabled:opacity-50"
    >
      {pending ? "…" : "remove"}
    </button>
  );
}
