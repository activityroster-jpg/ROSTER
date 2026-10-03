"use client";

import { useEffect, useState } from "react";
import { biometricPinSaved, biometricsAvailable, disablePush, enablePush, forgetBiometricPin, isNative, pushEnabled } from "@/lib/mobile/native";

/**
 * Settings that only make sense inside the native app (Capacitor): phone
 * notifications and biometric unlock. Renders nothing in an ordinary browser.
 */
export function NativeSettings() {
  const [native, setNative] = useState(false);
  const [push, setPush] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bio, setBio] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative()) return;
    setNative(true);
    setPush(pushEnabled());
    setBio(biometricPinSaved());
    void biometricsAvailable().then(setBioOk);
  }, []);

  if (!native) return null;

  const togglePush = async () => {
    setMsg(null);
    if (push) { await disablePush(); setPush(false); setMsg("Phone notifications off."); return; }
    const r = await enablePush();
    if (r === "granted") { setPush(true); setMsg("Phone notifications on."); }
    else setMsg(r === "denied" ? "Notifications are blocked for ActivityRoster in your phone's settings." : "Not available on this device.");
  };
  const toggleBio = async () => {
    setMsg(null);
    if (bio) { await forgetBiometricPin(); setBio(false); setMsg("You'll be asked for your PIN next time."); }
    else setMsg("Tick “Use Face ID / fingerprint next time” on the PIN screen to turn this on.");
  };

  const row = (label: string, sub: string, on: boolean, onClick: () => void, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center justify-between py-2 text-left disabled:opacity-50">
      <span><span className="block text-sm font-medium text-navy">{label}</span><span className="text-xs text-slate-500">{sub}</span></span>
      <span className={`ml-3 inline-flex h-6 w-11 flex-none items-center rounded-full p-0.5 ${on ? "bg-teal" : "bg-slate-300"}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} /></span>
    </button>
  );

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <h2 className="mb-1 font-semibold text-navy">App</h2>
      <div className="divide-y divide-slate-100">
        {row("Phone notifications", "Rota changes, open shifts, leave decisions, expiring licences", push, togglePush)}
        {row("Face ID / fingerprint unlock", bioOk ? "Instead of typing your PIN" : "Not available on this device", bio, toggleBio, !bioOk)}
      </div>
      {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
    </div>
  );
}
