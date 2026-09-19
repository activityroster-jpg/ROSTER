"use client";

import { useActionState } from "react";
import { inviteInstructorAction, type ActionState } from "@/app/(app)/office/staff/actions";

const initial: ActionState = { ok: false };

export function InviteInstructorButton({ instructorId, linked }: { instructorId: string; linked: boolean }) {
  const [state, action, pending] = useActionState(inviteInstructorAction, initial);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="instructorId" value={instructorId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-navy hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Sending…" : linked ? "Re-send invite" : "Invite to portal"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-port">{state.error}</span> : null}
      {state.ok ? <span className="ml-2 text-xs text-starboard">{state.message}</span> : null}
    </form>
  );
}
