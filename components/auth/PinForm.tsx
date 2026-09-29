"use client";

import { useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { setPinAction, verifyPinAction } from "@/app/pin/actions";

export function PinForm({ mode, next }: { mode: "enter" | "set"; next: string }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const res = mode === "set" ? await setPinAction(pin, confirm, next) : await verifyPinAction(pin, next);
      // On success the action redirects; only failures return here.
      if (res && !res.ok) { setErr(res.error ?? "Something went wrong"); setPin(""); setConfirm(""); }
    });
  };

  const pinInput = (value: string, set: (v: string) => void, label: string, autoFocus = false) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="••••"
        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-teal"
      />
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo variant="onLight" size="sm" /></div>
        <h1 className="text-center font-display text-xl font-bold text-navy">
          {mode === "set" ? "Set your login PIN" : "Enter your PIN"}
        </h1>
        <p className="mx-auto mt-1 mb-5 max-w-xs text-center text-sm text-slate-500">
          {mode === "set"
            ? "Choose a 4-digit PIN. You'll enter it each time you sign in, as a second layer of security."
            : "Enter your 4-digit PIN to continue."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {pinInput(pin, setPin, mode === "set" ? "New 4-digit PIN" : "Your PIN", true)}
          {mode === "set" ? pinInput(confirm, setConfirm, "Confirm PIN") : null}
          {err ? <p className="text-center text-sm text-port">{err}</p> : null}
          <button
            type="submit"
            disabled={pending || pin.length !== 4 || (mode === "set" && confirm.length !== 4)}
            className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {pending ? "Please wait…" : mode === "set" ? "Set PIN & continue" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
