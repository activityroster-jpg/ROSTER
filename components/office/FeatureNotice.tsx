"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableFeatureAction } from "@/app/(app)/office/feature-actions";
import { FEATURE_META } from "@/lib/features";
import type { OptionalFeature } from "@/lib/db/schema";

/**
 * Shown at the top of an optional-capability page when the centre hasn't switched
 * it on. The page still works (nothing is gated) — this just makes clear it isn't
 * part of their active setup, with a one-click way to turn it on.
 */
export function FeatureNotice({ feature, enabled }: { feature: OptionalFeature; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (enabled || done) return null;

  const meta = FEATURE_META[feature];
  const turnOn = () => startTransition(async () => {
    const res = await enableFeatureAction(feature);
    if (res.ok) { setDone(true); router.refresh(); }
  });

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber/40 bg-amber/10 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-navy">{meta.label} isn&apos;t switched on for your centre</p>
        <p className="text-xs text-slate-600">{meta.blurb} You can still use this page — turn it on to include it in your setup and onboarding.</p>
      </div>
      <button
        onClick={turnOn}
        disabled={pending}
        className="flex-none rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? "Turning on…" : `Use ${meta.label.toLowerCase()}`}
      </button>
    </div>
  );
}
