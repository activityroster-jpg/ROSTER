"use client";

import { useEffect, useState } from "react";

/**
 * Settings that only make sense inside the native app (Capacitor). Renders
 * nothing in an ordinary browser. The biometric unlock and push toggles are
 * wired up in lib/mobile/native (next step); for now this shows app status.
 */
export function NativeSettings() {
  const [native, setNative] = useState(false);
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    setNative(Boolean(cap?.isNativePlatform?.()));
  }, []);
  if (!native) return null;
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <h2 className="mb-1 font-semibold text-navy">App</h2>
      <p className="text-xs text-slate-500">You&apos;re using the ActivityRoster app. Face ID / fingerprint unlock and push notifications are managed from here once enabled on this device.</p>
    </div>
  );
}
