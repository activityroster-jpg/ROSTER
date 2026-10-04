"use client";

import { useState } from "react";

export type CancelChoice = { reason: string; rule: "none" | "rostered" | "fee"; fee?: number };

const RULES: { id: CancelChoice["rule"]; label: string; hint: string }[] = [
  { id: "none", label: "Don't pay", hint: "Their pay lines for it are removed." },
  { id: "rostered", label: "Pay as rostered", hint: "They're paid the hours they were booked for." },
  { id: "fee", label: "Pay a cancellation fee", hint: "A flat amount per person instead of the hours." },
];

/**
 * The questions every cancellation asks: why, and what the people on it are
 * paid. Used for one day and for a whole course. The reason goes to the
 * people rostered and into the change log, so it stays factual.
 */
export function CancelPanel({ what, people, pending, onConfirm, onClose }: {
  /** "this day" or "the whole course (3 remaining days)". */
  what: string;
  /** How many people will be told. */
  people: number;
  pending: boolean;
  onConfirm: (choice: CancelChoice) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [rule, setRule] = useState<CancelChoice["rule"]>("none");
  const [fee, setFee] = useState("");
  const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
  return (
    <div role="dialog" aria-label={`Cancel ${what}`} className="mt-3 rounded-xl border border-port/30 bg-port/5 p-4">
      <p className="text-sm font-semibold text-navy">Cancel {what}?</p>
      <p className="mt-0.5 text-xs text-slate-600">
        It leaves the roster, the printable roster, the emergency sheet and the app. {people > 0 ? `${people} ${people === 1 ? "person" : "people"} rostered will be told by notification and email.` : "Nobody is rostered on it."} It stays in the change log and can be restored.
      </p>
      <label className="mt-3 block text-xs font-medium text-slate-600">Reason (sent to the people on it)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Gale warning for Saturday" className={`mt-1 ${field}`} />
      </label>
      {people > 0 ? (
        <fieldset className="mt-3">
          <legend className="text-xs font-medium text-slate-600">What they're paid for it</legend>
          <div className="mt-1 space-y-1.5">
            {RULES.map((r) => (
              <label key={r.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="radio" name="cancel-pay" checked={rule === r.id} onChange={() => setRule(r.id)} className="mt-1 accent-teal" />
                <span><span className="font-medium text-navy">{r.label}</span> <span className="text-xs text-slate-500">{r.hint}</span></span>
              </label>
            ))}
          </div>
          {rule === "fee" ? (
            <label className="mt-2 block text-xs font-medium text-slate-600">Fee per person
              <input type="number" min={0} step="0.01" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className={`mt-1 w-32 ${field}`} />
            </label>
          ) : null}
        </fieldset>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || (rule === "fee" && !(Number(fee) >= 0 && fee !== ""))}
          onClick={() => onConfirm({ reason, rule, fee: rule === "fee" ? Number(fee) : undefined })}
          className="rounded-lg bg-port px-4 py-2 text-sm font-semibold text-white hover:bg-port/90 disabled:opacity-50"
        >
          {pending ? "Cancelling…" : `Cancel ${what}`}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">Keep it</button>
      </div>
    </div>
  );
}
