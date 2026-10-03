"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishWeekAction } from "@/app/(app)/office/rota/actions";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/**
 * Publish state for one week of the roster. Draft weeks are invisible to
 * instructors; publishing shows them the week and asks them to confirm.
 */
export function PublishWeek({ weekStart, publishedAt, sessions, assigned, confirmed, declined }: {
  weekStart: string;
  publishedAt: string | null;
  sessions: number;
  assigned: number;
  confirmed: number;
  declined: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const publish = () => start(async () => {
    const r = await publishWeekAction(weekStart);
    setMsg(r.ok ? r.message ?? "Published" : r.error ?? "Could not publish");
    router.refresh();
  });
  const awaiting = Math.max(0, assigned - confirmed - declined);

  if (!publishedAt) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/50 bg-amber/10 px-4 py-3 print:hidden">
        <div>
          <p className="text-sm font-semibold text-navy">Draft — your instructors can&apos;t see this week yet</p>
          <p className="text-xs text-slate-600">Move people around freely. When everyone&apos;s assigned, publish it and they&apos;ll be asked to confirm.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg ? <span className="text-xs text-slate-600" role="status">{msg}</span> : null}
          <button type="button" onClick={publish} disabled={pending || sessions === 0} title={sessions === 0 ? "Nothing scheduled this week" : undefined} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {pending ? "Publishing…" : "Publish week"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-starboard/40 bg-starboard/5 px-4 py-3 print:hidden">
      <div>
        <p className="text-sm font-semibold text-navy">Published {fmt(publishedAt)}</p>
        <p className="text-xs text-slate-600">
          {assigned === 0 ? "Nobody rostered yet." : <>{confirmed} of {assigned} confirmed{awaiting ? ` · ${awaiting} waiting` : ""}{declined ? <> · <span className="font-semibold text-port">{declined} can&apos;t make it</span></> : null}</>}
          {" "}Changes you make now notify the instructor straight away.
        </p>
      </div>
      <div className="flex items-center gap-3">
        {msg ? <span className="text-xs text-slate-600" role="status">{msg}</span> : null}
        <button type="button" onClick={publish} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-white disabled:opacity-50">
          {pending ? "Sending…" : "Re-publish & remind everyone"}
        </button>
      </div>
    </div>
  );
}
