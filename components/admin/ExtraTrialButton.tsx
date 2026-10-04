"use client";

import { useState, useTransition } from "react";
import { activateExtraTrialAction } from "@/app/admin/trial-feedback/actions";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

/** Gives the centre another 30 days of free trial, once, after asking to confirm. */
export function ExtraTrialButton({ feedbackId, centreName, disabledReason }: { feedbackId: string; centreName: string; disabledReason?: string | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string; trialEndsAt?: string } | null>(null);

  if (result?.ok) {
    return <p className="text-sm font-medium text-starboard">Activated. {centreName}&rsquo;s free trial now runs until {result.trialEndsAt ? fmt(result.trialEndsAt) : "30 days from now"}, and its admins have been emailed.</p>;
  }
  return (
    <div>
      <button
        type="button"
        disabled={pending || Boolean(disabledReason)}
        onClick={() => {
          if (!window.confirm(`Give ${centreName} another 30 days of free trial? Its admins will be emailed. This can only be done once for this feedback.`)) return;
          start(async () => setResult(await activateExtraTrialAction(feedbackId)));
        }}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Activating…" : "Activate 30-day trial"}
      </button>
      {disabledReason ? <p className="mt-1.5 text-xs text-slate-500">{disabledReason}</p> : null}
      {result?.error ? <p role="alert" className="mt-1.5 text-sm text-port">{result.error}</p> : null}
    </div>
  );
}
