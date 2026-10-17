"use client";

import { useEffect, useState } from "react";
import { enablePush, isNative, nativePlatform, openNotificationSettings, pushEnabled, pushPermission } from "@/lib/mobile/native";

type Perm = "prompt" | "granted" | "denied" | "unavailable";
const SHEET_KEY = "ar.push.sheetOn";
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Gets phone notifications switched on, because without them an instructor only
 * learns about a changed shift when they happen to open the app.
 *
 *  - Never asked yet: a full-screen sheet the first time the app opens each day,
 *    with the reason and a Turn on button (which shows the phone's own box), and
 *    a slim bar at the top of every page in between.
 *  - Said no on the phone's box: the same, but pointing at the phone's Settings,
 *    since the box can't be shown twice (iOS opens Settings from the button).
 *  - Allowed but not registered (a reinstall): registers quietly.
 *  - Granted and registered, or not in the app at all: nothing.
 */
export function PushPrompt() {
  const [perm, setPerm] = useState<Perm | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    let gone = false;
    void (async () => {
      let p = await pushPermission();
      if (p === "granted" && !pushEnabled()) {
        const r = await enablePush();
        p = r === "granted" ? "granted" : r === "denied" ? "denied" : p;
      }
      if (gone) return;
      setPerm(p);
      if (p === "prompt" || p === "denied") {
        let last: string | null = null;
        try { last = localStorage.getItem(SHEET_KEY); } catch { /* ignore */ }
        if (last !== today()) setSheet(true);
      }
    })();
    return () => { gone = true; };
  }, []);

  if (!perm || perm === "granted" || perm === "unavailable" || done) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === "granted") { setDone(true); return; }
      if (r === "denied") setPerm("denied");
    } finally { setBusy(false); }
  };
  const notNow = () => {
    try { localStorage.setItem(SHEET_KEY, today()); } catch { /* ignore */ }
    setSheet(false);
  };
  const openSettings = () => { if (!openNotificationSettings()) setSheet(true); };

  const denied = perm === "denied";
  const android = nativePlatform() === "android";
  const settingsPath = android ? "Phone Settings → Apps → ActivityRoster → Notifications → Allow" : "Settings → Notifications → ActivityRoster → Allow Notifications";

  if (sheet) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-navy/70 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16" role="dialog" aria-modal="true" aria-labelledby="push-title">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-2xl" aria-hidden>🔔</div>
          <h1 id="push-title" className="font-display text-2xl font-bold text-navy">{denied ? "Notifications are switched off" : "Know the moment your shifts change"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {denied
              ? "Your phone is blocking ActivityRoster notifications, so a changed shift, an open shift or a leave decision only reaches you when you next open the app."
              : "With notifications on, a changed shift, a new open shift, a leave decision or an expiring licence reaches your phone straight away. Without them, you only find out when you next open the app."}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>• Shift added, moved or cancelled</li>
            <li>• Open shifts you could take</li>
            <li>• Leave approved or declined</li>
            <li>• A licence or check about to run out</li>
          </ul>
          {denied ? (
            <>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Switch it back on under <span className="font-medium text-navy">{settingsPath}</span>, then come back to the app.</p>
              {!android ? <button type="button" onClick={openSettings} className="mt-4 w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700">Open phone Settings</button> : null}
            </>
          ) : (
            <button type="button" onClick={turnOn} disabled={busy} className="mt-5 w-full rounded-xl bg-teal px-4 py-3.5 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "One moment…" : "Turn on notifications"}</button>
          )}
          <button type="button" onClick={notNow} className="mt-3 w-full py-2 text-center text-sm font-medium text-slate-500">Not now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-amber/20 px-4 py-2 text-xs text-navy">
      <span className="min-w-0 flex-1">
        {denied ? "Notifications are blocked on this phone, so shift changes wait until you open the app." : "Phone notifications are off, so shift changes wait until you open the app."}
      </span>
      {denied
        ? (android
          ? <button type="button" onClick={() => setSheet(true)} className="shrink-0 rounded-lg bg-navy px-2.5 py-1 font-semibold text-white">How to fix</button>
          : <button type="button" onClick={openSettings} className="shrink-0 rounded-lg bg-navy px-2.5 py-1 font-semibold text-white">Open Settings</button>)
        : <button type="button" onClick={turnOn} disabled={busy} className="shrink-0 rounded-lg bg-navy px-2.5 py-1 font-semibold text-white disabled:opacity-50">{busy ? "…" : "Turn on"}</button>}
    </div>
  );
}
