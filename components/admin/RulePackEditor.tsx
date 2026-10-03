"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetRulePackAction, saveRulePackAction } from "@/app/admin/rules/actions";

export interface PackView {
  key: string;
  name: string;
  version: string;
  verified: boolean;
  source: "builtin" | "edited";
  updatedAt: string | null;
  updatedBy: string | null;
  unverified: string[];
  citations: { label: string; url: string }[];
  bands: { label: string; ages: string; term: string; holiday: string; hours: string; rest: string }[];
  json: string;
}

export function RulePackEditor({ packs }: { packs: PackView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null);

  const save = (key: string) => start(async () => {
    const r = await saveRulePackAction(key, draft);
    setMsg({ key, ok: r.ok, text: r.error ?? r.message ?? "" });
    if (r.ok) { setEditing(null); router.refresh(); }
  });
  const reset = (key: string) => start(async () => {
    if (!confirm("Discard the edited figures and go back to the built-in pack?")) return;
    const r = await resetRulePackAction(key);
    setMsg({ key, ok: r.ok, text: r.error ?? r.message ?? "" });
    router.refresh();
  });

  return (
    <div className="space-y-4">
      {packs.map((p) => (
        <section key={p.key} className="rounded-card border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-navy">{p.name}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">v{p.version}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.verified ? "Verified" : `${p.unverified.length} unverified figure${p.unverified.length === 1 ? "" : "s"}`}</span>
            <span className="text-xs text-slate-400">{p.source === "edited" ? `Edited ${p.updatedAt ? new Date(p.updatedAt).toLocaleString("en-GB") : ""} by ${p.updatedBy ?? "?"}` : "Built-in figures"}</span>
            <div className="ml-auto flex gap-2">
              {editing === p.key ? (
                <>
                  <button disabled={pending} onClick={() => save(p.key)} className="rounded-lg bg-teal px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Save</button>
                  <button disabled={pending} onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-navy">Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditing(p.key); setDraft(p.json); setMsg(null); }} className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-navy hover:bg-slate-50">Edit JSON</button>
                  {p.source === "edited" ? <button disabled={pending} onClick={() => reset(p.key)} className="rounded-lg border border-port/40 px-3 py-1 text-xs text-port hover:bg-port/5">Reset to built-in</button> : null}
                </>
              )}
            </div>
          </div>
          {msg?.key === p.key ? <p className={`mt-2 text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}

          <table className="mt-3 w-full text-left text-xs">
            <thead className="text-slate-400"><tr><th className="py-1 pr-2">Band</th><th className="py-1 pr-2">Term time</th><th className="py-1 pr-2">Holidays</th><th className="py-1 pr-2">Hours</th><th className="py-1">Breaks & rest</th></tr></thead>
            <tbody>
              {p.bands.map((b) => (
                <tr key={b.label} className="border-t border-slate-100 align-top">
                  <td className="py-1 pr-2 font-medium text-navy">{b.label}<div className="font-normal text-slate-400">{b.ages}</div></td>
                  <td className="py-1 pr-2 text-slate-600">{b.term}</td>
                  <td className="py-1 pr-2 text-slate-600">{b.holiday}</td>
                  <td className="py-1 pr-2 text-slate-600">{b.hours}</td>
                  <td className="py-1 text-slate-600">{b.rest}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.unverified.length ? <p className="mt-2 text-xs text-amber-700">Not yet verified: {p.unverified.join(" · ")}</p> : null}
          <p className="mt-1 text-xs text-slate-400">Sources: {p.citations.map((c, i) => <span key={c.url}>{i ? " · " : ""}<a href={c.url} target="_blank" rel="noreferrer" className="text-teal hover:underline">{c.label}</a></span>)}</p>

          {editing === p.key ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-slate-500">Edit the figures, then Save. Remove a field name from a band&rsquo;s <code>unverified</code> list once you have checked it against the source, and set <code>verified</code> to true only when every list is empty.</p>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={28} spellCheck={false} className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs outline-none focus:border-teal" />
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
