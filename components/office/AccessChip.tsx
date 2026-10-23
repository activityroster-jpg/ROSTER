"use client";

import { InviteInstructorButton, invitedAgo, type InviteStatus } from "./InviteInstructorButton";

/**
 * One chip for a person's app access on the Instructors list, with the
 * actions behind it: not invited, invite sent (re-send), in the app, phone
 * alerts off, or no sign-up needed when the office keeps their availability.
 */
export function AccessChip({ instructorId, status, sentAt, queued, hasEmail, officeManaged, phoneAlertsOff }: {
  instructorId: string; status: InviteStatus; sentAt: number | null; queued: boolean; hasEmail: boolean; officeManaged: boolean; phoneAlertsOff: boolean;
}) {
  const label = status === "accepted"
    ? (phoneAlertsOff ? "In the app · alerts off" : "In the app")
    : status === "pending"
      ? (queued ? "Invite queued" : `Invite sent ${sentAt ? invitedAgo(sentAt) : ""}`.trim())
      : officeManaged ? "No sign-up needed" : hasEmail ? "Not invited" : "No email";
  const tone = status === "accepted" ? (phoneAlertsOff ? "bg-amber/15 text-amber" : "bg-starboard/15 text-starboard") : status === "pending" ? "bg-amber/15 text-amber" : "bg-slate-100 text-slate-600";
  const explain = status === "accepted" && phoneAlertsOff
    ? "They're in the app but phone notifications are off, so roster changes only reach them when they open it or by email."
    : officeManaged && status === "none"
      ? "The office keeps their availability, so they don't need the app. You can still invite them if they'd like it."
      : status === "pending"
        ? "Access starts when they open the invite. One reminder goes automatically after a day; re-send if it went astray."
        : !hasEmail ? "Add an email on their profile to invite them to the app." : null;
  return (
    <details className="group relative inline-block">
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`} title="App access">
        {label} <span aria-hidden className="text-[9px] opacity-70">▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
        {explain ? <p className="mb-2 text-xs text-slate-600">{explain}</p> : null}
        {hasEmail ? <InviteInstructorButton instructorId={instructorId} status={status} sentAt={sentAt} queued={queued} /> : null}
      </div>
    </details>
  );
}
