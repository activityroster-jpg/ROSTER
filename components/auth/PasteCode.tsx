"use client";

import { useEffect, useRef } from "react";
import { readCodeFromClipboard } from "@/lib/mobile/clipboard";

/**
 * Fill a 6-digit code from the clipboard: automatically when the person comes
 * back to this screen (they copied it from the email), and from a Paste button.
 * `active` says a code is wanted right now (one has been sent and the box is
 * still empty), so returning to the app at other times reads nothing.
 */
export function useCodeFromClipboard(active: boolean, onCode: (code: string) => void) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!active) return;
    let gone = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const code = await readCodeFromClipboard();
      if (code && !gone) cb.current(code);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => { gone = true; document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [active]);
}

export function PasteCodeButton({ onCode, onMiss, disabled, className }: { onCode: (code: string) => void; onMiss?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => { const code = await readCodeFromClipboard(); if (code) onCode(code); else onMiss?.(); }}
      className={className ?? "whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50"}
    >
      Paste code
    </button>
  );
}

export const NO_CODE_ON_CLIPBOARD = "Nothing to paste yet. In the email, press and hold the code and choose Copy, then come back.";
