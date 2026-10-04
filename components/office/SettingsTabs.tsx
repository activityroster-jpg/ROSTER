"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface SettingsTab { id: string; label: string; hint?: string }

/** Anchors other pages link to, mapped to the tab that holds them. */
const HASH_TO_TAB: Record<string, string> = { "availability-window": "general", "rota-pdf": "roster", retention: "data", welfare: "roster" };

/**
 * Settings as tabs (audit Part E phase 3). Every panel is rendered on the
 * server; this only shows one at a time, picks the tab from ?tab= or from an
 * anchor someone linked to (#rota-pdf opens the Roster tab, then scrolls).
 */
export function SettingsTabs({ tabs, panels, initial = "general" }: { tabs: SettingsTab[]; panels: Record<string, ReactNode>; initial?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const fromQuery = params.get("tab");
  const [active, setActive] = useState<string>(fromQuery && tabs.some((t) => t.id === fromQuery) ? fromQuery : initial);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const tab = HASH_TO_TAB[hash];
    if (hash && tab && tabs.some((t) => t.id === tab)) {
      setActive(tab);
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }, [tabs]);

  const pick = (id: string) => {
    setActive(id);
    const q = new URLSearchParams(params.toString());
    q.set("tab", id);
    router.replace(`?${q.toString()}`, { scroll: false });
  };

  return (
    <div>
      <div role="tablist" aria-label="Settings sections" className="mb-5 flex flex-wrap gap-1 rounded-card border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} title={t.hint} onClick={() => pick(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active === t.id ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>{panels[t.id]}</div>
      ))}
    </div>
  );
}
