"use client";

import { useState } from "react";
import { ScreenShot } from "./ScreenShot";
import { GUIDE_SCREENS, SCREENS } from "@/lib/screens";
import { PROVIDERS } from "@/lib/integrations/catalogue";
import { GUIDE_STAGES, SECTIONS, type Block } from "@/lib/learn/sections";

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-slate-600">{b.text}</p>;
    case "sub":
      return <h3 className="mt-5 font-display text-base font-semibold text-navy">{b.text}</h3>;
    case "steps":
      return (
        <ol className="ml-1 space-y-2">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal text-[11px] font-bold text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className="space-y-1.5">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-teal" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="rounded-lg border-l-4 border-amber bg-amber/10 px-4 py-2.5 text-sm text-navy">
          <span className="font-semibold">Tip:</span> {b.text}
        </div>
      );
    case "providerHelp":
      return (
        <div className="space-y-2">
          {PROVIDERS.filter((p) => p.icsHelp).map((p) => (
            <div key={p.id} id={`integration-${p.id}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">{p.name}</p>
                <div className="flex items-center gap-2">
                  {p.apiAdapter ? <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal">API key too</span> : null}
                  {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal hover:underline">Open {p.name} ↗</a> : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.icsHelp}</p>
            </div>
          ))}
        </div>
      );
  }
}

/** The screenshots for a guide: office shots full width, app shots side by side underneath. */
function GuideScreens({ sectionId }: { sectionId: string }) {
  const screens = (GUIDE_SCREENS[sectionId] ?? []).map((id) => SCREENS[id]);
  if (screens.length === 0) return null;
  const desktops = screens.filter((s) => s.device === "desktop");
  const phones = screens.filter((s) => s.device === "phone");
  return (
    <div className="mt-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">What it looks like</p>
      <div className="space-y-4">
        {desktops.map((s) => (
          <figure key={s.src}>
            <ScreenShot screen={s} />
            <figcaption className="mt-1.5 text-xs text-slate-500">{s.caption}</figcaption>
          </figure>
        ))}
        {phones.length ? (
          <div className="flex flex-wrap justify-center gap-6">
            {phones.map((s) => (
              <figure key={s.src} className="w-[220px]">
                <ScreenShot screen={s} />
                <figcaption className="mt-1.5 text-center text-xs text-slate-500">{s.title} · in the instructor app</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Screens from a made-up centre. Click any screen to see it full size.</p>
    </div>
  );
}

export function LearningCenter({ initialTopic }: { initialTopic?: string }) {
  const startId = initialTopic && SECTIONS.some((s) => s.id === initialTopic) ? initialTopic : SECTIONS[0]!.id;
  const [active, setActive] = useState(startId);
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Learning Centre</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">How to use ActivityRoster</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          A step-by-step guide to every part of the platform, in the order you&apos;ll need it: set up your centre,
          add courses and instructors, build the roster, then run the season. Help and troubleshooting are at the end.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Tab list */}
        <nav aria-label="Learning topics" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const on = s.id === active;
              const stageIndex = GUIDE_STAGES.findIndex((g) => g.ids[0] === s.id);
              const stage = stageIndex >= 0 ? GUIDE_STAGES[stageIndex] : undefined;
              return (
                <li key={s.id} className="flex-none lg:flex-auto">
                  {stage ? (
                    <p className={`hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block ${stageIndex > 0 ? "pt-4" : ""}`}>
                      {stageIndex + 1}. {stage.label}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActive(s.id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${on ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    <span aria-hidden="true">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Panel */}
        <article className="min-w-0 rounded-card border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">{section.icon}</span>
            <div>
              <h2 className="font-display text-2xl font-bold text-navy">{section.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{section.blurb}</p>
            </div>
          </div>
          <GuideScreens sectionId={section.id} />

          <div className="mt-6 space-y-3">
            {section.blocks.map((b, i) => <BlockView key={i} b={b} />)}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <a href="/#get-demo" className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Start my free month</a>
            <span className="text-xs text-slate-400">Every centre gets the whole platform — explore each topic to see what&apos;s included.</span>
          </div>
        </article>
      </div>
    </div>
  );
}
