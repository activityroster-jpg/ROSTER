"use client";

import { useState, useTransition } from "react";
import { stepUpWithPinAction } from "@/app/pin/actions";
import { ConfirmDialog } from "./ConfirmDialog";
import { biometricPinSaved, isNative, unlockPinWithBiometrics } from "@/lib/mobile/native";

/**
 * A download or action that needs the PIN again first (full export, person
 * export, anonymise). Asks only when the last step-up is over ten minutes old.
 */
export function StepUpButton({ label, href, onVerified, className, consequences, title }: {
  label: string;
  /** Navigate here once verified (a download). */
  href?: string;
  /** Or run this once verified (an action). */
  onVerified?: () => void;
  className?: string;
  title: string;
  consequences: string[];
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const go = () => { setOpen(false); setPin(""); if (href) window.location.href = href; onVerified?.(); };
  const begin = () => start(async () => {
    setErr(null);
    const r = await stepUpWithPinAction(null);
    if (r.ok) { go(); return; }
    if (!r.needsPin) { setErr(r.error ?? "Please sign in again"); return; }
    // In the app, Face ID / fingerprint first; typing the PIN is the fallback.
    if (isNative() && biometricPinSaved()) {
      const saved = await unlockPinWithBiometrics().catch(() => null);
      if (saved) { const b = await stepUpWithPinAction(saved); if (b.ok) { go(); return; } }
    }
    setOpen(true);
  });
  const confirm = () => start(async () => {
    const r = await stepUpWithPinAction(pin);
    if (r.ok) go(); else { setErr(r.error ?? "Incorrect PIN"); setPin(""); }
  });
  return (
    <>
      <button type="button" onClick={begin} disabled={pending} className={className}>{label}</button>
      {err && !open ? <span role="alert" className="ml-2 text-xs text-port">{err}</span> : null}
      <ConfirmDialog open={open} title={title} consequences={consequences} confirmLabel="Continue" tone="navy" busy={pending} onCancel={() => { setOpen(false); setPin(""); setErr(null); }} onConfirm={confirm}>
        <label className="block text-xs font-medium text-slate-500">Your 4-digit PIN
          <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter" && pin.length === 4) confirm(); }} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-teal" aria-label="PIN" />
        </label>
        {err ? <p role="alert" className="mt-2 text-xs text-port">{err}</p> : null}
      </ConfirmDialog>
    </>
  );
}
