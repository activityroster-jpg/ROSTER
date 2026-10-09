"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { forgetDevicesAction } from "@/app/verify-device/actions";

export interface TrustedDeviceRow { id: string; device: string; ip: string; country: string | null; lastSeen: string }

/** The devices/networks this user has confirmed with their password, plus a "forget all". */
export function TrustedDevices({ rows }: { rows: TrustedDeviceRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const forget = async () => {
    if (!await askConfirm("Forget all devices? You'll be asked for your password again on every device, including this one.")) return;
    start(async () => {
      const r = await forgetDevicesAction();
      setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Could not forget devices");
      if (r.ok) router.refresh();
    });
  };

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No devices confirmed yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="font-medium text-navy">{r.device}</span>
                <span className="block text-xs text-slate-400">{r.ip}{r.country ? ` · ${r.country}` : ""}</span>
              </div>
              <span className="whitespace-nowrap text-xs text-slate-400">{r.lastSeen}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={forget} disabled={pending || rows.length === 0} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">
          {pending ? "…" : "Forget all devices"}
        </button>
        {msg ? <span className="text-xs text-slate-500">{msg}</span> : null}
      </div>
    </div>
  );
}
