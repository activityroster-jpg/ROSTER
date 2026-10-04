"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { keepFormerStaffAction } from "@/app/(app)/office/staff/actions";

/** On a former staff member's profile: when their record will be anonymised, with a one-click "keep". */
export function RetentionBanner({ instructorId, deleteOn, months }: { instructorId: string; deleteOn: string; months: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-navy">
      <span>This profile is scheduled to be anonymised on <strong>{new Date(deleteOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong> under your retention settings.</span>
      <button disabled={pending} onClick={() => start(async () => { const r = await keepFormerStaffAction(instructorId); setMsg(r.ok ? r.message ?? "Kept" : r.error ?? "Failed"); router.refresh(); })} className="rounded-lg border border-navy/30 bg-white px-3 py-1 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Keep for another {months} months</button>
      {msg ? <span className="text-xs text-slate-600">{msg}</span> : null}
    </div>
  );
}
