"use client";

import { useEffect, useState } from "react";
import { isStaleActionError } from "@/lib/ui/stale-action";
import { BUILD_ID } from "@/lib/build-id";

/** Don't ask the server which build is live more often than this. */
const VERSION_CHECK_MIN_MS = 60_000;

/**
 * A save or a page fetch that gets no answer in this long is treated as
 * stalled: it is cancelled so the page's queue moves on, and the office is
 * asked to reload. Next runs a page's saves one after another, so one that
 * never answers would otherwise freeze every button after it (12 Oct: the
 * centre admin "frozen after heavy use" while a fresh window was fine).
 */
const ACTION_STALL_MS = 90_000;
/** A save running longer than this shows the "still working" indicator, so confirming a big week or Auto-roster never looks frozen. */
const SHOW_PROGRESS_MS = 2_500;
const PAGE_STALL_MS = 40_000;
/** Saves slower than this are reported (no banner) so the Dev Center shows where time goes. */
const SLOW_MS = 8_000;

/** Signed-in areas, where an unexpected failure is worth reporting (the public site has browser-extension noise). */
const REPORTED_AREAS = /^\/(office|portal|admin|app|welcome|set-pin|pin|verify-login|verify-device|security|two-factor)(\/|$)/;

/**
 * Watches for a save that fails without telling anyone (9 Oct: an equipment
 * delete and a location category that "did nothing" / stuck on "Adding…").
 * A page left open across an update holds the old version's save actions,
 * which the new version doesn't recognise; reloading fixes it, so say that.
 * Anything else that fails is reported to the Dev Center error log.
 */
export function ActionFailureWatcher() {
  const [stale, setStale] = useState(false);
  // A save answered with a Cloudflare security check (an HTML page instead of
  // the action's result): the page looks frozen until it is reloaded.
  const [challenged, setChallenged] = useState(false);
  // Saves in flight (count) and when the oldest started, for the progress indicator.
  const [inFlight, setInFlight] = useState<{ count: number; since: number }>({ count: 0, since: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!inFlight.count) return;
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, [inFlight.count]);
  // A new build went live while this page was open: say so before a save fails.
  useEffect(() => {
    if (BUILD_ID === "dev" || !REPORTED_AREAS.test(window.location.pathname)) return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < VERSION_CHECK_MIN_MS) return;
      last = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const j = (await r.json()) as { build?: string };
        if (j.build && j.build !== BUILD_ID) setStale(true);
      } catch { /* offline or blocked: nothing to say */ }
    };
    const onChange = () => { void check(); };
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("focus", onChange);
    const timer = window.setInterval(onChange, 5 * VERSION_CHECK_MIN_MS);
    return () => { document.removeEventListener("visibilitychange", onChange); window.removeEventListener("focus", onChange); window.clearInterval(timer); };
  }, []);
  // Stall guard: every save (Next-Action) and page fetch (RSC) gets a deadline.
  useEffect(() => {
    const w = window as Window & { __arStallGuard?: boolean };
    if (w.__arStallGuard || !REPORTED_AREAS.test(window.location.pathname)) return;
    w.__arStallGuard = true;
    const original = window.fetch.bind(window);
    const headerOf = (init: RequestInit | undefined, input: RequestInfo | URL, name: string): string | null => {
      const h = init?.headers;
      if (h instanceof Headers) return h.get(name);
      if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
      if (h && typeof h === "object") { for (const k of Object.keys(h)) if (k.toLowerCase() === name.toLowerCase()) return (h as Record<string, string>)[k] ?? null; }
      if (input instanceof Request) return input.headers.get(name);
      return null;
    };
    const report = (message: string) => void original("/api/report-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.slice(0, 2000), path: window.location.pathname }) }).catch(() => {});
    window.fetch = (input, init) => {
      const isAction = Boolean(headerOf(init, input, "Next-Action"));
      const isPage = !isAction && Boolean(headerOf(init, input, "RSC"));
      if ((!isAction && !isPage) || init?.signal) return original(input, init);
      const ac = new AbortController();
      const started = Date.now();
      let stalled = false;
      const timer = window.setTimeout(() => { stalled = true; ac.abort(); }, isAction ? ACTION_STALL_MS : PAGE_STALL_MS);
      if (isAction) setInFlight((f) => ({ count: f.count + 1, since: f.count ? f.since : started }));
      return original(input, { ...init, signal: ac.signal }).then(
        (res) => { const took = Date.now() - started; if (isAction && took > SLOW_MS) report(`[slow] save took ${Math.round(took / 1000)}s`); return res; },
        (err: unknown) => {
          if (stalled) { setChallenged(true); report(`[stalled] ${isAction ? "save" : "page"} got no answer in ${Math.round((Date.now() - started) / 1000)}s; cancelled`); }
          throw err;
        },
      ).finally(() => {
        window.clearTimeout(timer);
        if (isAction) setInFlight((f) => ({ count: Math.max(0, f.count - 1), since: f.count > 1 ? f.since : 0 }));
      });
    };
    // Never unpatched: the guard lives as long as the page.
  }, []);
  useEffect(() => {
    const seen = new Set<string>();
    const handle = (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
      if (!message) return;
      // A redirect or not-found thrown by a server action (the PIN gate sending
      // someone to /pin, say) is navigation, not a failure: the router follows it.
      const digest = String((reason as { digest?: unknown })?.digest ?? "");
      if (/^NEXT_(REDIRECT|NOT_FOUND)/.test(digest) || /^NEXT_(REDIRECT|NOT_FOUND)$/.test(message)) return;
      if (isStaleActionError(message)) { setStale(true); return; }
      if (/unexpected response was received from the server|failed to fetch|load failed|aborted|signal timed out/i.test(message)) { setChallenged(true); }
      if (/aborted|signal timed out/i.test(message)) return; // the stall guard already reported it
      if (seen.has(message) || !REPORTED_AREAS.test(window.location.pathname)) return;
      seen.add(message);
      void fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `[unhandled] ${message}`.slice(0, 2000), digest: (reason as { digest?: string })?.digest, path: window.location.pathname }),
      }).catch(() => {});
    };
    const onRejection = (e: PromiseRejectionEvent) => handle(e.reason);
    const onError = (e: ErrorEvent) => handle(e.error ?? e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => { window.removeEventListener("unhandledrejection", onRejection); window.removeEventListener("error", onError); };
  }, []);
  if (!stale && challenged) {
    return (
      <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-navy px-4 py-3 text-sm text-white shadow-lg print:hidden">
        <span>That&rsquo;s taking longer than it should. It may still be finishing: wait a minute, then reload to check before trying again. Anything saved before this is safe.</span>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-navy">Reload</button>
        <button type="button" onClick={() => setChallenged(false)} className="text-white/70 hover:text-white">Dismiss</button>
      </div>
    );
  }
  const waited = inFlight.count ? now - inFlight.since : 0;
  if (!stale && waited >= SHOW_PROGRESS_MS) {
    return (
      <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full bg-navy px-4 py-2 text-sm text-white shadow-lg print:hidden">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
        <span>Working on it… {Math.round(waited / 1000)}s{waited > 15_000 ? " · big changes can take up to a minute, keep this page open" : ""}</span>
      </div>
    );
  }
  if (!stale) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-navy px-4 py-3 text-sm text-white shadow-lg print:hidden">
      <span>ActivityRoster has been updated since this page was opened. Reload to carry on with the latest version; a save from the old page won&rsquo;t go through.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-navy">Reload</button>
    </div>
  );
}
