"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkStatusByNameAction,
  createProspectAction,
  dedupeProspectsAction,
  importProspectsAction,
  loadRyaDirectoryAction,
  seedSampleProspectsAction,
  type ProspectResult,
} from "@/app/admin/marketing/actions";
import { PROSPECT_STATUS_META, PROSPECT_STATUS_ORDER } from "@/lib/marketing";

const initial: ProspectResult = { ok: false };

const FIELDS: { name: string; label: string; wide?: boolean }[] = [
  { name: "name", label: "Centre / club name", wide: true },
  { name: "region", label: "Region" },
  { name: "contactName", label: "Contact name" },
  { name: "contactRole", label: "Role (Principal / Owner)" },
  { name: "email", label: "Email" },
  { name: "addressLine1", label: "Address line 1" },
  { name: "addressLine2", label: "Address line 2" },
  { name: "city", label: "City / town" },
  { name: "postcode", label: "Postcode" },
  { name: "website", label: "Website" },
  { name: "linkedinUrl", label: "LinkedIn URL", wide: true },
];

export function ProspectTools({ hasRows }: { hasRows: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"none" | "add" | "import" | "bulk">("none");
  const [addState, addAction, adding] = useActionState(createProspectAction, initial);
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState<ProspectResult | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState("letter_sent");
  const [bulkMsg, setBulkMsg] = useState<(ProspectResult & { unmatched?: string[] }) | null>(null);

  const doBulk = async (mode: "add" | "remove") => {
    const n = bulkText.split(/\r?\n/).filter((l) => l.trim()).length;
    const label = PROSPECT_STATUS_META[bulkStatus as keyof typeof PROSPECT_STATUS_META]?.label ?? bulkStatus;
    if (!await askConfirm(`${mode === "add" ? "Add" : "Remove"} “${label}” on up to ${n} centre${n === 1 ? "" : "s"}?`)) return;
    setBulkMsg(null);
    startTransition(async () => {
      const res = await bulkStatusByNameAction(bulkText, bulkStatus, mode);
      setBulkMsg(res);
      if (res.ok) router.refresh();
    });
  };

  const doImport = () => {
    setImportMsg(null);
    startTransition(async () => {
      const res = await importProspectsAction(csv);
      setImportMsg(res);
      if (res.ok) { setCsv(""); setFileName(null); router.refresh(); }
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setCsv(text);
    } catch {
      setImportMsg({ ok: false, error: "Could not read that file. Try pasting the CSV instead." });
    }
  };
  const seed = () => startTransition(async () => { await seedSampleProspectsAction(); router.refresh(); });
  const dedupe = async () => {
    if (!await askConfirm("Merge duplicate centres? Rows with the same name and postcode are combined into one, keeping the furthest-along status and all notes.")) return;
    setImportMsg(null);
    startTransition(async () => { const res = await dedupeProspectsAction(); setImportMsg(res); router.refresh(); });
  };
  const loadDirectory = async () => {
    if (!await askConfirm("Add every centre from the RYA directory (2,138)? Centres already on your list are skipped and keep their statuses.")) return;
    setImportMsg(null);
    startTransition(async () => { const res = await loadRyaDirectoryAction(); setImportMsg(res); router.refresh(); });
  };

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab(tab === "add" ? "none" : "add")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "add" ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>+ Add prospect</button>
        <button onClick={() => setTab(tab === "import" ? "none" : "import")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "import" ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>Import CSV</button>
        <button onClick={loadDirectory} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">{pending ? "Working…" : "Load RYA directory"}</button>
        {hasRows ? <button onClick={() => setTab(tab === "bulk" ? "none" : "bulk")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "bulk" ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>Bulk status by name</button> : null}
        {hasRows ? <button onClick={dedupe} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Merge duplicates</button> : null}
        {!hasRows ? <button onClick={seed} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">Add example rows</button> : null}
      </div>
      {tab !== "import" && importMsg ? (
        <p role="status" className={`mt-2 text-sm ${importMsg.ok ? "text-starboard" : "text-port"}`}>{importMsg.ok ? importMsg.message : importMsg.error}</p>
      ) : null}

      {tab === "add" ? (
        <form action={addAction} className="mt-3 rounded-card border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.name} className={f.wide ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
                <input name={f.name} required={f.name === "name"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button disabled={adding} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">{adding ? "Adding…" : "Add prospect"}</button>
            {addState.error ? <span className="text-sm text-port">{addState.error}</span> : null}
            {addState.ok ? <span className="text-sm text-starboard">{addState.message}</span> : null}
          </div>
        </form>
      ) : null}

      {tab === "bulk" ? (
        <div className="mt-3 rounded-card border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Paste centre names, one per line (numbering like &ldquo;12.&rdquo; is ignored), pick a status, then add it to or remove it from every matching centre. Names are matched ignoring case, spaces and punctuation.</p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} placeholder={"Jersey Sea Sport Centre\nRoyal Channel Islands Yacht Club\n…"} className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-teal" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">Status
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="ml-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                {PROSPECT_STATUS_ORDER.filter((s) => s !== "new").map((s) => <option key={s} value={s}>{PROSPECT_STATUS_META[s].label}</option>)}
              </select>
            </label>
            <button onClick={() => doBulk("remove")} disabled={pending || !bulkText.trim()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">{pending ? "Working…" : "Mark as NOT done (remove status)"}</button>
            <button onClick={() => doBulk("add")} disabled={pending || !bulkText.trim()} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Working…" : "Mark as done (add status)"}</button>
          </div>
          {bulkMsg?.error ? <p role="status" className="mt-2 text-sm text-port">{bulkMsg.error}</p> : null}
          {bulkMsg?.ok ? <p role="status" className="mt-2 text-sm text-starboard">{bulkMsg.message}</p> : null}
          {bulkMsg?.ok && bulkMsg.unmatched?.length ? (
            <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Names not found on your list ({bulkMsg.unmatched.length})</summary>
              <ul className="mt-1 list-disc pl-5">{bulkMsg.unmatched.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === "import" ? (
        <div className="mt-3 rounded-card border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Upload a <span className="font-semibold">.csv</span> file, or paste CSV below. Either way it needs a header row. Recognised columns: <span className="font-mono text-xs">name, region, address 1, address 2, city, postcode, email, website, linkedin, contact, role, notes</span>.</p>
          <p className="mt-1 text-xs text-slate-400">Tip: export the public RYA &ldquo;Find a Training Centre&rdquo; list to a spreadsheet and save it as CSV.</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50">
              Choose CSV file…
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
            </label>
            {fileName ? <span className="text-xs text-slate-500">Loaded <span className="font-medium text-navy">{fileName}</span> — review below, then Import.</span> : <span className="text-xs text-slate-400">or paste below</span>}
          </div>

          <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setFileName(null); }} rows={7} placeholder={"name,region,city,postcode,email,contact,role\nExample SC,South West,Exampleton,EX1 1AA,info@ex.test,A. Person,Principal"} className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-teal" />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={doImport} disabled={pending || !csv.trim()} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Importing…" : "Import"}</button>
            {importMsg?.error ? <span className="text-sm text-port">{importMsg.error}</span> : null}
            {importMsg?.ok ? <span className="text-sm text-starboard">{importMsg.message}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
