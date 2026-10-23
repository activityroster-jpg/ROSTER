"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearExampleWeekAction, loadExampleWeekAction } from "@/app/(app)/office/example-week-actions";

/**
 * The example week (lib/services/example-week): a button to put it on the
 * roster, a notice while it is there, and one click to clear it.
 */
export function LoadExampleWeekButton({ className, label = "Load an example week" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setMsg(null);
          const r = await loadExampleWeekAction();
          if (!r.ok) { setMsg(r.error ?? "Could not load the example"); return; }
          router.push(`/office/rota${r.week ? `?week=${r.week}` : ""}`);
        })}
        className={className ?? "rounded-lg border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal/5 disabled:opacity-60"}
      >
        {pending ? "Setting up the example…" : label}
      </button>
      {msg ? <span className="text-xs text-port">{msg}</span> : null}
    </span>
  );
}

export function ClearExampleWeekButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setMsg(null);
          const r = await clearExampleWeekAction();
          if (!r.ok) { setMsg(r.error ?? "Could not clear the example"); return; }
          router.refresh();
        })}
        className={className ?? "rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"}
      >
        {pending ? "Clearing…" : "Clear the example"}
      </button>
      {msg ? <span className="text-xs text-port">{msg}</span> : null}
    </span>
  );
}

/** Shown on the dashboard and the roster while the example is on the roster. */
export function ExampleWeekNotice({ instructors, sessions, from, to, week, showRosterLink = true }: { instructors: number; sessions: number; from: string | null; to: string | null; week: string | null; showRosterLink?: boolean }) {
  const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }) : "");
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/50 bg-amber/10 px-4 py-3 print:hidden">
      <p className="text-sm text-navy">
        <span className="font-semibold">This is the example week.</span> {instructors} made-up instructors (marked &ldquo;example&rdquo;) and {sessions} sessions, {fmt(from)} to {fmt(to)}. Try Auto-roster, confirm a day, print the PDF: nothing here is real. One click removes it all, and only it.
      </p>
      <span className="flex flex-wrap items-center gap-2">
        {showRosterLink ? <Link href={`/office/rota${week ? `?week=${week}` : ""}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">Open the roster →</Link> : null}
        <ClearExampleWeekButton className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60" />
      </span>
    </div>
  );
}
