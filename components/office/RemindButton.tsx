"use client";

import { useState, useTransition } from "react";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { remindStaffAction } from "@/app/(app)/office/staff/actions";
import type { ReminderKind } from "@/lib/notify/markers";

/**
 * Sends a reminder (in the app, with a phone push, and by email) to set
 * availability or update licences. One person's row, or everyone at once with
 * a confirmation. Each person gets at most one of each kind a day.
 */
export function RemindButton({ kind, instructorIds, label = "Remind", confirm, variant = "link" }: {
  kind: ReminderKind;
  instructorIds: string[];
  label?: string;
  /** Ask before sending (the "remind everyone" buttons). */
  confirm?: string;
  variant?: "link" | "button";
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; sent: number; text: string } | null>(null);

  const send = async () => {
    if (confirm && !(await askConfirm(confirm))) return;
    start(async () => {
      try {
        const r = await remindStaffAction({ kind, instructorIds });
        setResult({ ok: r.ok, sent: r.sent ?? 0, text: r.ok ? r.message ?? "Sent" : r.error ?? "That didn't send" });
      } catch {
        setResult({ ok: false, sent: 0, text: "That didn't send. Reload the page and try again." });
      }
    });
  };

  if (result && variant === "link") {
    return <span title={result.text} className={`whitespace-nowrap text-xs ${result.ok && result.sent ? "text-starboard" : "text-slate-500"}`}>{result.ok && result.sent ? "Reminded ✓" : result.ok ? "Reminded today" : "Didn't send"}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void send()}
        disabled={pending || (variant === "button" && result?.ok === true)}
        title={kind === "availability" ? "Send a reminder in the app and by email to mark when they're free" : "Send a reminder in the app and by email to upload their missing or expiring licences"}
        className={variant === "link"
          ? "whitespace-nowrap rounded-full border border-teal/40 px-2 py-0.5 text-[11px] font-semibold text-teal hover:bg-teal/10 disabled:opacity-50"
          : "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50"}
      >
        {pending ? "Sending…" : label}
      </button>
      {result && variant === "button" ? <span className={`text-xs ${result.ok ? "text-starboard" : "text-port"}`}>{result.text}</span> : null}
    </span>
  );
}
