"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { StatusPill } from "@/components/ui";
import { setDocMetaAction } from "@/app/(app)/office/staff/actions";

export interface DocItem {
  kind: "qualification" | "compliance";
  itemId: string;
  name: string;
  expiryDate: string | null;
  mandatory: boolean;
  hasFile: boolean;
  docKey: string | null;
  /** Vetting checks: status and certificate number only, no file. */
  noFile?: boolean;
  verified: boolean;
}

function status(d: DocItem): { tone: "covered" | "attention" | "conflict" | "neutral"; label: string } {
  if (d.noFile) return d.verified ? { tone: "covered", label: "Recorded" } : { tone: "neutral", label: "Awaiting check" };
  if (!d.hasFile) return { tone: "neutral", label: "Awaiting upload" };
  if (d.expiryDate) {
    const exp = Date.parse(`${d.expiryDate}T23:59:59Z`);
    if (exp < Date.now()) return { tone: "conflict", label: "Expired" };
    if (exp < Date.now() + 42 * 864e5) return { tone: "attention", label: "Expiring soon" };
  }
  return d.verified ? { tone: "covered", label: "Verified" } : { tone: "attention", label: "Awaiting check" };
}

/**
 * Shared licence/document manager. Instructors (admin=false) upload a photo,
 * pick which licence it's for, and set an expiry. Centres (admin=true) can also
 * upload, edit the expiry and mark a document verified.
 */
export function DocumentManager({ items, admin }: { items: DocItem[]; admin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const uploadable = items.filter((d) => !d.noFile);
  const [sel, setSel] = useState(uploadable[0] ? `${uploadable[0].kind}:${uploadable[0].itemId}` : "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const file = fileRef.current?.files?.[0];
    if (!sel || !file) { setMsg("Pick a licence and choose a file."); return; }
    const [kind, itemId] = sel.split(":");
    const fd = new FormData();
    fd.set("kind", kind!); fd.set("itemId", itemId!); fd.set("file", file);
    if (expiry) fd.set("expiryDate", expiry);
    setBusy(true);
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) { setMsg("Uploaded ✓"); if (fileRef.current) fileRef.current.value = ""; setExpiry(""); router.refresh(); }
      else setMsg(data.error ?? "Upload failed");
    } catch { setMsg("Upload failed"); }
    setBusy(false);
  };

  const saveMeta = (d: DocItem, patch: { expiryDate?: string | null; verified?: boolean }) =>
    start(async () => { await setDocMetaAction(d.kind, d.itemId, patch); router.refresh(); });

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div>
      {items.length === 0 ? (
        <p className="mb-4 text-sm text-slate-400">No certs or checks listed yet.</p>
      ) : (
        <ul className="mb-5 divide-y divide-slate-100">
          {items.map((d) => {
            const st = status(d);
            return (
              <li key={`${d.kind}:${d.itemId}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-navy">{d.name}</span>
                  {d.mandatory ? <span className="ml-1 text-xs text-port">· required</span> : null}
                  <span className="block text-xs text-slate-400">{d.expiryDate ? `Expires ${d.expiryDate}` : "No expiry set"}{d.noFile ? " · status and certificate number only, no file is kept" : ""}</span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  {d.hasFile && d.docKey ? <a href={`/api/documents/download?key=${encodeURIComponent(d.docKey)}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-teal hover:underline">View</a> : null}
                  {d.hasFile ? <button type="button" onClick={() => { setSel(`${d.kind}:${d.itemId}`); setMsg(`Choose the new file for ${d.name} below — it replaces the old one.`); fileRef.current?.focus(); fileRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="text-xs font-medium text-slate-500 hover:text-navy">Replace</button> : null}
                  {admin ? (
                    <>
                      <input type="date" defaultValue={d.expiryDate ?? ""} onChange={(e) => saveMeta(d, { expiryDate: e.target.value || null })} className="rounded border border-slate-300 px-2 py-1 text-xs" title="Expiry date" />
                      <button onClick={() => saveMeta(d, { verified: !d.verified })} disabled={pending} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${d.verified ? "border border-slate-300 text-slate-500" : "bg-starboard text-white"}`}>
                        {d.verified ? "Unverify" : "Verify"}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {uploadable.length > 0 ? (
        <form onSubmit={upload} className="rounded-lg bg-canvas p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{admin ? "Upload a document" : "Upload a cert photo or PDF"}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Which cert?</label>
              <select value={sel} onChange={(e) => setSel(e.target.value)} className={field}>
                {items.filter((d) => !d.noFile).map((d) => <option key={`${d.kind}:${d.itemId}`} value={`${d.kind}:${d.itemId}`}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Expiry (if any)</label>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">File (PDF or photo)</label>
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" />
            </div>
            <button disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy ? "Uploading…" : "Upload"}</button>
          </div>
          {msg ? <p className="mt-2 text-sm text-slate-600">{msg}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
