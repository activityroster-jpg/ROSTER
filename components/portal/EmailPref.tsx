"use client";

import { useState, useTransition } from "react";
import { setNotifyEmailAction } from "@/app/(app)/portal/notifications/actions";

export function EmailPref({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await setNotifyEmailAction(next);
      if (!res.ok) setOn(!next); // revert on failure
    });
  };

  return (
    <label className="flex items-center gap-3 text-sm text-slate-700">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition ${on ? "bg-teal" : "bg-slate-300"} disabled:opacity-60`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      <span>Also email me when I&apos;m notified <span className="text-slate-400">(in-app alerts stay on either way)</span></span>
    </label>
  );
}
