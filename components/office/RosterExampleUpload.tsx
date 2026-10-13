"use client";

import { useRef, useState } from "react";

export interface RosterExampleRow { key: string; name: string; uploadedAt: string }

/**
 * "Send us the roster you use today": a PDF or photo of the centre's current
 * roster, so we can make the downloadable roster look the same.
 */
export function RosterExampleUpload({ initial = [] }: { initial?: RosterExampleRow[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [sent, setSent] = useState<RosterExampleRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/office/roster-example", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; example?: RosterExampleRow };
      if (res.ok && data.example) {
        setSent((s) => [data.example!, ...s]);
        setMsg({ ok: true, text: "Thanks. We'll shape your roster PDF to match and let you know when it's ready." });
      } else setMsg({ ok: false, text: data.error ?? "That didn't upload. Try again." });
    } catch {
      setMsg({ ok: false, text: "That didn't upload. Check your connection and try again." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-teal/50 bg-teal/5 p-4">
      <p className="text-sm font-semibold text-navy">Want it to look like the roster you use now?</p>
      <p className="mt-1 text-xs text-slate-600">Upload an example (a PDF, or a photo of the one on the wall). We&apos;ll set up your downloadable roster in the same style and layout, so your team sees what they&apos;re used to. Optional: the standard layout works fine meanwhile.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
          {busy ? "Uploading…" : sent.length ? "Upload another" : "Upload my roster"}
        </button>
        <span className="text-xs text-slate-500">PDF, PNG, JPEG or WebP · 10 MB max</span>
      </div>
      {msg ? <p className={`mt-2 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      {sent.length ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {sent.map((e) => <li key={e.key}>✓ {e.name} · sent {new Date(e.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
