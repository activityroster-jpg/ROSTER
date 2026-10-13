"use client";

import { useEffect, useState } from "react";
import { EXPLAINER, videoUrl } from "@/lib/learn/videos";
import { GuideVideo } from "./GuideVideo";

/** The homepage's two-minute explainer, shown once the video is on the site. */
export function HomeExplainer() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch(videoUrl(EXPLAINER, "png"), { method: "HEAD" }).then((r) => setReady(r.ok)).catch(() => {});
  }, []);
  if (!ready) return null;
  return (
    <section id="see-it" className="border-b border-slate-200 bg-canvas">
      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <p className="text-center text-sm font-semibold uppercase tracking-wide text-teal">See it in two minutes</p>
        <h2 className="mt-1 text-center font-display text-2xl font-semibold text-navy md:text-3xl" style={{ textWrap: "balance" }}>From a spreadsheet and a group chat to a roster that fills itself</h2>
        <div className="mt-8"><GuideVideo video={EXPLAINER} /></div>
        <p className="mt-4 text-center text-sm text-slate-600">Want the detail? <a href="/learn" className="font-semibold text-teal hover:underline">Twelve short how-to videos in the Learning Centre →</a></p>
      </div>
    </section>
  );
}
