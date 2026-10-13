"use client";

import { useEffect, useState } from "react";
import { TOTAL_VIDEOS, videoUrl, type SiteVideo } from "@/lib/learn/videos";

/**
 * A how-to video, the centrepiece of its Learning Centre section (and the
 * homepage explainer). Shown only once the video is on the site, so a guide
 * never shows a broken player.
 */
export function GuideVideo({ video, kicker }: { video: SiteVideo; kicker?: string }) {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch(videoUrl(video, "png"), { method: "HEAD" }).then((r) => { if (live) setReady(r.ok); }).catch(() => { if (live) setReady(false); });
    return () => { live = false; };
  }, [video]);
  if (!ready) return null;
  const label = kicker ?? (video.n ? `Video ${video.n} of ${TOTAL_VIDEOS}` : "Two-minute tour");
  return (
    <figure className="overflow-hidden rounded-card border border-slate-200 bg-navy shadow-sm">
      <video controls preload="none" playsInline poster={videoUrl(video, "png")} className="aspect-video w-full bg-navy" aria-label={video.title}>
        <source src={videoUrl(video, "mp4")} type="video/mp4" />
        <track kind="captions" srcLang="en" label="English" src={videoUrl(video, "vtt")} />
      </video>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 bg-white px-4 py-2.5 text-sm">
        <span><span className="mr-2 text-xs font-semibold uppercase tracking-wide text-teal">▶ {label}</span><span className="font-semibold text-navy">{video.title}</span></span>
        <span className="text-xs text-slate-500">Captions available · {video.description}</span>
      </figcaption>
    </figure>
  );
}
