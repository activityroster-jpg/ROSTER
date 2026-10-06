"use client";

import { useEffect, useState } from "react";
import { SCREENS, TOUR, type ScreenId } from "@/lib/screens";
import { ScreenShot } from "./ScreenShot";

const ORDER: ScreenId[] = TOUR.flatMap((g) => g.ids);

/**
 * The demo: a guided tour of real screenshots from a busy centre. Pick a
 * screen from the list, or step through with the arrows (or the arrow keys).
 */
export function ProductTour() {
  const [index, setIndex] = useState(0);
  const id = ORDER[index]!;
  const screen = SCREENS[id];
  const go = (d: number) => setIndex((i) => (i + d + ORDER.length) % ORDER.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warm the next screen so stepping through feels instant.
  const next = SCREENS[ORDER[(index + 1) % ORDER.length]!];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Tour stops" className="min-w-0">
        {TOUR.map((g) => (
          <div key={g.group} className="mb-2 lg:mb-4">
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</p>
            <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
              {g.ids.map((sid) => {
                const on = sid === id;
                return (
                  <li key={sid} className="flex-none">
                    <button
                      type="button"
                      onClick={() => setIndex(ORDER.indexOf(sid))}
                      aria-current={on ? "true" : undefined}
                      className={`w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${on ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {SCREENS[sid].title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <figure className="min-w-0">
        <div className={screen.device === "phone" ? "mx-auto w-full max-w-[300px]" : ""}>
          <ScreenShot key={id} screen={screen} eager />
        </div>
        <figcaption className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="font-display text-lg font-semibold text-navy">{screen.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{screen.caption}</p>
            <a href={`/learn?topic=${screen.topic}`} className="mt-1 inline-block text-sm font-medium text-teal hover:underline">📖 Read the guide</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{index + 1} of {ORDER.length}</span>
            <button type="button" onClick={() => go(-1)} aria-label="Previous screen" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50">←</button>
            <button type="button" onClick={() => go(1)} aria-label="Next screen" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700">Next →</button>
          </div>
        </figcaption>
        <link rel="prefetch" href={next.src} as="image" />
      </figure>
    </div>
  );
}
