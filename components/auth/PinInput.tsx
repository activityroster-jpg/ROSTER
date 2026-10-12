"use client";

import { useState } from "react";

/**
 * A 4-digit PIN box that hides the digits by default, with a "Show" toggle for
 * when the person wants to check what they typed. Used wherever a PIN is entered
 * (sign-in, setting or resetting a PIN, the step-up check before a sensitive action).
 */
export function PinInput({ value, onChange, label, autoFocus = false, onEnter, size = "lg", id }: {
  value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean; onEnter?: () => void; size?: "lg" | "sm"; id?: string;
}) {
  const [shown, setShown] = useState(false);
  const inputId = id ?? `pin-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-500">{label}</label>
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={inputId} className="text-xs font-medium text-teal hover:underline">{shown ? "Hide PIN" : "View PIN"}</button>
      </div>
      <input
        id={inputId}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter && value.length === 4) { e.preventDefault(); onEnter(); } }}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="••••"
        aria-label={label}
        className={size === "lg"
          ? "w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-teal"
          : "block w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-teal"}
      />
    </div>
  );
}
