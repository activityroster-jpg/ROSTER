"use client";

import { useEffect } from "react";

/** Opens the print dialog once the page has rendered (fonts loaded). */
export function AutoPrint() {
  useEffect(() => {
    const t = window.setTimeout(() => { try { window.print(); } catch { /* ignore */ } }, 600);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
