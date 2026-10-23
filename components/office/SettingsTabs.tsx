"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface SettingsTab { id: string; label: string; hint?: string }
/** One setting, for "Find a setting": where it lives and words people might use for it. */
export interface SettingsIndexEntry { label: string; tab: string; anchor?: string; keywords?: string }

/** Anchors other pages link to, mapped to the tab that holds them. */
const HASH_TO_TAB: Record<string, string> = { "availability-window": "general", "staff-managed-by": "general", "rota-pdf": "roster", retention: "data", welfare: "roster", "pay-rates": "pay", "onboarding-tracker": "general" };

/**
 * Settings as tabs (audit Part E phase 3). Every panel is rendered on the
 * server; this only shows one at a time, picks the tab from ?tab= or from an
 * anchor someone linked to (#rota-pdf opens the Roster tab, then scrolls).
 */
export function SettingsTabs({ tabs, panels, initial = "general", index = [] }: { tabs: SettingsTab[]; panels: Record<string, ReactNode>; initial?: string; index?: SettingsIndexEntry[] }) {
  const [q, setQ] = useState("");
  const hits = q.trim().length < 2 ? [] : index.filter((e) => `${e.label} ${e.keywords ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const jump = (e: SettingsIndexEntry) => { pick(e.tab); setQ(""); if (e.anchor) requestAnimationFrame(() => document.getElementById(e.anchor!)?.scrollIntoView({ block: "start", behavior: "smooth" })); };
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
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="mb-5 lg:sticky lg:top-4 lg:mb-0">
        {index.length ? (
          <div className="relative mb-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a setting…" aria-label="Find a setting" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
            {hits.length ? (
              <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {hits.map((e) => (
                  <li key={`${e.tab}-${e.anchor ?? e.label}`}>
                    <button type="button" onClick={() => jump(e)} className="block w-full px-3 py-2 text-left text-sm text-navy hover:bg-slate-50">
                      {e.label}<span className="block text-[11px] text-slate-400">{tabs.find((t) => t.id === e.tab)?.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : q.trim().length >= 2 ? <p className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">Nothing by that name. Try another word, or ask the Help button.</p> : null}
          </div>
        ) : null}
        <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-1 rounded-card border border-slate-200 bg-white p-1 lg:flex-col">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={active === t.id} title={t.hint} onClick={() => pick(t.id)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm font-medium ${active === t.id ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}>
              {t.label}
              <span className={`hidden text-[11px] font-normal lg:block ${active === t.id ? "text-white/70" : "text-slate-400"}`}>{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        {tabs.map((t) => (
          <div key={t.id} role="tabpanel" hidden={active !== t.id}>{panels[t.id]}</div>
        ))}
      </div>
    </div>
  );
}
