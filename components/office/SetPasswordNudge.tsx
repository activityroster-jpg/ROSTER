"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/** Shown to admins who only ever signed in with an emailed link: one tap sends them a set-a-password link. */
export function SetPasswordNudge({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const send = async () => {
    setState("busy");
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setState(res.error ? "error" : "sent");
  };
  if (state === "sent") return <p className="bg-starboard/10 px-6 py-2 text-center text-sm text-navy">Check your email for a link to set your password.</p>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-amber/15 px-6 py-2 text-center text-sm text-navy">
      <span>You sign in with an emailed link. A password makes sign-in quicker and safer.</span>
      <button onClick={send} disabled={state === "busy"} className="font-semibold text-teal hover:underline disabled:opacity-50">{state === "busy" ? "Sending…" : "Set a password →"}</button>
      {state === "error" ? <span className="text-port">Could not send the link; try again shortly.</span> : null}
    </div>
  );
}
