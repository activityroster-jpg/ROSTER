"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { parentDecideAction } from "@/app/(app)/parent/actions";

/** The one thing a parent does here: approve, decline or withdraw permission for their child to work at the centre. */
export function ParentDecision({ linkId, childName, centreName, decision, decidedAt }: { linkId: string; childName: string; centreName: string; decision: string | null; decidedAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const decide = (d: "approved" | "declined" | "withdrawn") => {
    const q = d === "approved" ? `Approve ${childName} working at ${centreName}?` : d === "declined" ? `Decline? ${centreName} will not roster ${childName} until you approve.` : `Withdraw your approval? ${centreName} will stop rostering ${childName} from now on.`;
    if (!confirm(q)) return;
    start(async () => { await parentDecideAction(linkId, d); router.refresh(); });
  };
  const when = decidedAt ? new Date(decidedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-medium text-navy">Your permission for {childName} to work here</p>
      {decision === "approved" ? (
        <p className="mt-1 text-xs text-starboard">Approved{when ? ` on ${when}` : ""}. You can withdraw it at any time.</p>
      ) : decision === "declined" ? (
        <p className="mt-1 text-xs text-port">Declined{when ? ` on ${when}` : ""}. The centre won&rsquo;t roster {childName} unless you approve.</p>
      ) : decision === "withdrawn" ? (
        <p className="mt-1 text-xs text-port">Withdrawn{when ? ` on ${when}` : ""}. You can approve again if you change your mind.</p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">{centreName} has asked for your permission before rostering {childName}. Please answer below. You can read how the centre looks after young people at <a href="/privacy/young-people" target="_blank" rel="noreferrer" className="text-teal hover:underline">activityroster.com/privacy/young-people</a>.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {decision !== "approved" ? <button type="button" disabled={pending} onClick={() => decide("approved")} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Approve</button> : null}
        {decision !== "declined" && decision !== "approved" ? <button type="button" disabled={pending} onClick={() => decide("declined")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Decline</button> : null}
        {decision === "approved" ? <button type="button" disabled={pending} onClick={() => decide("withdrawn")} className="rounded-lg border border-port/40 bg-white px-3 py-1.5 text-xs font-medium text-port hover:bg-port/5 disabled:opacity-50">Withdraw approval</button> : null}
      </div>
    </div>
  );
}
