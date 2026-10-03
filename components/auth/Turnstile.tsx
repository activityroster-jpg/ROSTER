"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/security/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void; theme?: string; size?: string; appearance?: string }) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = SCRIPT; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
  return loading;
}

/**
 * Renders the Turnstile widget and hands the token up. Managed mode: usually
 * a brief "verifying" flash, a visible challenge only for suspicious traffic.
 * `resetKey` changes force a fresh token (after a failed submit).
 */
export function Turnstile({ onToken, resetKey = 0, className = "" }: { onToken: (token: string | null) => void; resetKey?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (idRef.current) { window.turnstile.reset(idRef.current); return; }
      idRef.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        appearance: "interaction-only",
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return <div ref={ref} className={className} />;
}
