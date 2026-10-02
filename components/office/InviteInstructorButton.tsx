"use client";

import { useActionState } from "react";
import { inviteInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";

const initial: ActionState = { ok: false };

export type InviteStatus = "none" | "pending" | "accepted";

export function InviteInstructorButton({ instructorId, status }: { instructorId: string; status: InviteStatus }) {
  const [state, action, pending] = useActionState(inviteInstructorAction, initial);

  return (
    <form action={action} className="inline">
      {status === "pending" ? (
        <span className="mr-2 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber" title="Invite sent — access starts when they open it">Invite pending</span>
      ) : status === "accepted" ? (
        <span className="mr-2 rounded-full bg-starboard/15 px-2 py-0.5 text-[10px] font-semibold text-starboard">Portal access</span>
      ) : null}
      <input type="hidden" name="instructorId" value={instructorId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Sending…" : status === "none" ? "Invite to portal" : "Re-send invite"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-port">{state.error}</span> : null}
      {state.ok ? <span className="ml-2 text-xs text-starboard">{state.message}</span> : null}
    </form>
  );
}
