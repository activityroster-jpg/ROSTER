"use client";

import { useActionState } from "react";
import { setRecoveryEmailAction, type RecoveryState } from "@/app/(app)/security/actions";

const initial: RecoveryState = { ok: false };

/** Lets an admin set a recovery email (separate from their sign-in email). */
export function RecoveryEmailForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState(setRecoveryEmailAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="recoveryEmail" className="mb-1 block text-xs font-medium text-slate-500">Recovery email</label>
        <input
          id="recoveryEmail"
          name="recoveryEmail"
          type="email"
          required
          defaultValue={current ?? ""}
          placeholder="you@personal-email.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal"
        />
        <p className="mt-1 text-xs text-slate-400">Used only to recover access if you&apos;re locked out — never for sign-in.</p>
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "Saving…" : current ? "Update recovery email" : "Save recovery email"}
      </button>
      {state.ok ? <p className="text-sm text-starboard">{state.message}</p> : state.error ? <p className="text-sm text-port">{state.error}</p> : null}
    </form>
  );
}
