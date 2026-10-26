"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server a public page was viewed (Dev Center → Traffic sources).
 * No cookies, no storage, nothing about the visitor beyond the page, the site
 * that linked here (first page only) and any utm_ tags in the address.
 */
export function PageViewBeacon() {
  const path = usePathname();
  const first = useRef(true);
  // The path last sent: React may run this twice for one page (development), and that must count once.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!path || sent.current === path) return;
    sent.current = path;
    try {
      const q = new URLSearchParams(window.location.search);
      const body = JSON.stringify({
        p: path,
        r: first.current ? document.referrer || null : null,
        us: q.get("utm_source"), um: q.get("utm_medium"), uc: q.get("utm_campaign"),
      });
      first.current = false;
      const blob = new Blob([body], { type: "application/json" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/v", blob))) {
        void fetch("/api/v", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => {});
      }
    } catch { /* never in the way */ }
  }, [path]);
  return null;
}
