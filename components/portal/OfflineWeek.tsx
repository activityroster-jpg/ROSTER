"use client";

import { useEffect } from "react";

export interface OfflineSession { day: string; dayLabel: string; time: string; course: string; place: string | null; note: string | null }

export const OFFLINE_KEY = "ar.offline.week";

/**
 * Saves the next seven days of my published schedule on this phone and makes
 * sure the offline helper is installed, so a beach with no signal still shows
 * the week (audit A11-1). Only my own shifts: course, time, place, my status.
 */
export function OfflineWeek({ centre, sessions }: { centre: string; sessions: OfflineSession[] }) {
  useEffect(() => {
    try { window.localStorage.setItem(OFFLINE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), centre, sessions })); } catch { /* private mode / storage blocked */ }
    try { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }); } catch { /* unsupported */ }
  }, [centre, sessions]);
  return null;
}

/** Forget the saved week (on sign-out, so a shared phone doesn't keep it). */
export function clearOfflineWeek(): void {
  try { window.localStorage.removeItem(OFFLINE_KEY); } catch { /* ignore */ }
}
