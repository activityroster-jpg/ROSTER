"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMyCalendarFeedAction, revokeMyCalendarFeedAction } from "@/app/(app)/portal/settings/actions";

/**
 * My shifts in my own calendar app: a private link the phone's calendar
 * subscribes to. Shown once when made; a new link replaces the old one.
 */
export function CalendarFeedCard({ active, createdAt }: { active: boolean; createdAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const make = () => start(async () => {
    const r = await createMyCalendarFeedAction();
    if (r.ok && r.url) { setUrl(r.url); setMsg(null); router.refresh(); } else setMsg(r.error ?? "Couldn't make a link");
  });
  const off = () => start(async () => {
    if (!confirm("Turn the calendar link off? Calendars using it stop updating straight away.")) return;
    const r = await revokeMyCalendarFeedAction();
    setUrl(null); setMsg(r.ok ? "Calendar link turned off." : r.error ?? "Failed"); router.refresh();
  });
  const webcal = url ? url.replace(/^https:/, "webcal:") : null;
  const copy = async () => { try { if (url) { await navigator.clipboard.writeText(url); setMsg("Link copied."); } } catch { setMsg("Couldn't copy; press and hold the link to copy it."); } };
  return (
    <div className="text-sm">
      {url ? (
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-3">
          <p className="mb-2 text-xs text-slate-600">Your private link. It's shown only now: add it to your calendar, or copy it somewhere safe. Anyone with it can see your shifts.</p>
          <p className="break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-navy">{url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {webcal ? <a href={webcal} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Add to my calendar</a> : null}
            {webcal ? <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy">Google Calendar</a> : null}
            <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy">Copy link</button>
          </div>
        </div>
      ) : active ? (
        <p className="text-xs text-slate-600">Your calendar link is on{createdAt ? ` (made ${new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}. Lost it, or want to stop an old phone seeing it? Make a new one; the old link stops working.</p>
      ) : (
        <p className="text-xs text-slate-600">See your shifts in your phone's calendar (Apple, Google or Outlook). Only published weeks appear, and they update about every hour.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={make} className="text-sm font-semibold text-teal disabled:opacity-50">{active || url ? "Make a new link" : "Make my calendar link"}</button>
        {active || url ? <button type="button" disabled={pending} onClick={off} className="text-xs text-slate-400 hover:text-port disabled:opacity-50">Turn off</button> : null}
        <a href="/learn?topic=app" target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">📖 Read the guide</a>
      </div>
      {msg ? <p className="mt-1 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
