"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "ar_2fa_nudge_dismissed";

/**
 * One-time nudge for a centre admin to turn on 2FA, shown once they have staff.
 * Dismissal is per-browser (localStorage) so it doesn't nag every page load.
 */
export function TwoFactorNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-amber/15 px-6 py-2 text-sm text-navy">
      <span>
        🔐 You&apos;ve added your team — protect their data by turning on two-factor authentication.{" "}
        <Link href="/security" className="font-semibold underline underline-offset-2 hover:text-teal">Set up 2FA →</Link>
      </span>
      <button
        type="button"
        onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setShow(false); }}
        className="flex-none rounded px-2 py-0.5 text-xs font-medium text-navy/60 hover:bg-amber/20 hover:text-navy"
        aria-label="Dismiss"
      >
        Dismiss ✕
      </button>
    </div>
  );
}
