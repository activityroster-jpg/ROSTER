"use client";

import { useState } from "react";
import { teamChatMessage } from "@/lib/domain/team-chat";

/** "Copy message": the team-chat note that says the invites are real, next to Invite on the Instructors page. */
export function CopyInviteMessage({ centreName, joinCode }: { centreName: string; joinCode: string | null }) {
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const finishBy = new Date(Date.now() + 7 * 86_400_000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const text = teamChatMessage(centreName, joinCode, finishBy);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setNote("Copied. Paste it into your team chat."); } catch { setOpen(true); setNote("Select the message and copy it."); } };
  return (
    <div className="inline-block">
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">Copy team-chat message</button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-teal hover:underline">{open ? "Hide" : "What it says"}</button>
        {note ? <span className="text-xs text-starboard">{note}</span> : null}
      </span>
      {open ? <textarea readOnly value={text} rows={8} onFocus={(e) => e.currentTarget.select()} className="mt-2 w-full max-w-xl rounded-lg border border-slate-300 bg-canvas px-3 py-2 text-sm text-slate-700" /> : null}
    </div>
  );
}
