"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateJoinCodeAction } from "@/app/(app)/office/settings/actions";

/** The centre's company code for the instructor app, with copy + regenerate. */
export function CompanyCodeCard({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setMsg("Copied"); } catch { setMsg("Select and copy the code"); }
  };
  const regen = async () => {
    if (!await askConfirm("Issue a new company code? The current one stops working immediately — anyone you've already given it to will need the new one.")) return;
    start(async () => {
      const r = await regenerateJoinCodeAction();
      setMsg(r.ok ? "New code issued" : r.error ?? "Could not regenerate");
      router.refresh();
    });
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-navy px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-white">{code}</span>
        <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Copy</button>
        <button type="button" onClick={regen} disabled={pending} className="text-sm font-medium text-slate-500 hover:text-port disabled:opacity-50">{pending ? "…" : "Issue a new code"}</button>
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Instructors download the <strong>ActivityRoster</strong> app, create their account and enter this code to join your centre.
        Anyone already on your Instructors list (matching email) is linked instantly; anyone else appears under <strong>Instructors → Join requests</strong> for you to approve.
      </p>
    </div>
  );
}
