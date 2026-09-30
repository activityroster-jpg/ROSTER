"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectIntegrationAction, removeIntegrationAction, syncIntegrationAction } from "@/app/(app)/office/integrations/actions";

interface ProviderUi { id: string; name: string; category: string; blurb: string; methods: string[]; apiPlanned?: boolean; icsHelp?: string; website?: string }
interface ConnectedUi { id: string; provider: string; name: string; kind: string; feedUrl: string | null; status: string; lastSyncedAt: string | null; lastResult: string | null }

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never";

export function BookingIntegrations({ providers, connected }: { providers: ProviderUi[]; connected: ConnectedUi[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const connectedByProvider = new Map(connected.map((c) => [c.provider, c]));

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Done" : res.error ?? "Failed" });
      if (res.ok) { setOpenId(null); setFeedUrl(""); router.refresh(); }
    });
  };

  return (
    <div className="space-y-6">
      {msg ? <p role="status" className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}

      {/* Connected */}
      {connected.length > 0 ? (
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold text-navy">Connected</h2>
          <div className="space-y-2">
            {connected.map((c) => (
              <div key={c.id} className="rounded-card border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{c.name}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.status === "connected" ? "bg-starboard/15 text-starboard" : c.status === "error" ? "bg-port/15 text-port" : "bg-slate-100 text-slate-500"}`}>{c.status}</span>
                    </p>
                    <p className="text-xs text-slate-500">Last sync: {fmt(c.lastSyncedAt)}{c.lastResult ? ` · ${c.lastResult}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => run(() => syncIntegrationAction(c.id))} disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Syncing…" : "Sync now"}</button>
                    <button type="button" onClick={() => { if (confirm("Disconnect this booking system?")) run(() => removeIntegrationAction(c.id)); }} disabled={pending} className="text-sm text-port hover:underline">Disconnect</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Catalogue */}
      <div>
        <h2 className="mb-1 font-display text-lg font-semibold text-navy">Connect a booking system</h2>
        <p className="mb-3 text-sm text-slate-500">
          Pull your courses straight in from the system you already take bookings in — via its calendar (iCal) feed.
          It&apos;s one-way and safe: we only read your sessions and never change anything in your booking system.
          No calendar feed? <a href="/office/import" className="text-teal hover:underline">Import from a spreadsheet</a> instead.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => {
            const conn = connectedByProvider.get(p.id);
            const open = openId === p.id;
            return (
              <div key={p.id} className={`rounded-card border p-4 ${open ? "border-teal" : "border-slate-200"} bg-white`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{p.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{p.category}</p>
                  </div>
                  {conn ? <span className="rounded-full bg-starboard/15 px-2 py-0.5 text-[10px] font-semibold text-starboard">connected</span> : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">{p.blurb}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.methods.map((m) => <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{m}</span>)}
                  {p.apiPlanned ? <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-medium text-amber">API soon</span> : null}
                </div>

                {open ? (
                  <div className="mt-3 space-y-2">
                    {p.icsHelp ? <p className="rounded-lg bg-canvas p-2 text-xs text-slate-600">{p.icsHelp}</p> : null}
                    <input value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://…/calendar.ics" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => run(() => connectIntegrationAction({ provider: p.id, kind: "ics", feedUrl }))} disabled={pending || !feedUrl.trim()} className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">{conn ? "Update feed" : "Connect"}</button>
                      <button type="button" onClick={() => { setOpenId(null); setFeedUrl(""); }} className="text-sm text-slate-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setOpenId(p.id); setFeedUrl(conn?.feedUrl ?? ""); setMsg(null); }} className="mt-3 text-sm font-semibold text-teal hover:underline">
                    {conn ? "Update connection" : p.methods.includes("ics") ? "Connect calendar feed →" : "Connect →"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
