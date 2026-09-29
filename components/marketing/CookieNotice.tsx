"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "ar_cookie_ack";

export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(KEY) !== "1") setShow(true); } catch { /* private mode */ }
  }, []);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setShow(false); };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          We use only the cookies needed to sign you in and keep the service secure — no tracking or ads.{" "}
          <Link href="/cookies" className="font-semibold text-teal hover:underline">Learn more</Link>.
        </p>
        <button onClick={dismiss} className="flex-none rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700">
          Got it
        </button>
      </div>
    </div>
  );
}
