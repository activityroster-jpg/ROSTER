"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProspectAction,
  importProspectsAction,
  seedSampleProspectsAction,
  type ProspectResult,
} from "@/app/admin/marketing/actions";

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
  const [tab, setTab] = useState<"none" | "add" | "import">("none");
  const [addState, addAction, adding] = useActionState(createProspectAction, initial);
  const [pending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState<ProspectResult | null>(null);

  const doImport = () => {
    setImportMsg(null);
    startTransition(async () => {
      const res = await importProspectsAction(csv);
      setImportMsg(res);
      if (res.ok) { setCsv(""); router.refresh(); }
    });
  };
  const seed = () => startTransition(async () => { await seedSampleProspectsAction(); router.refresh(); });

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab(tab === "add" ? "none" : "add")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "add" ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>+ Add prospect</button>
        <button onClick={() => setTab(tab === "import" ? "none" : "import")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "import" ? "bg-navy text-white" : "border border-slate-300 text-navy hover:bg-slate-50"}`}>Import CSV</button>
        {!hasRows ? <button onClick={seed} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">Add example rows</button> : null}
      </div>

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

      {tab === "import" ? (
        <div className="mt-3 rounded-card border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Paste CSV with a header row. Recognised columns: <span className="font-mono text-xs">name, region, address 1, address 2, city, postcode, email, website, linkedin, contact, role, notes</span>.</p>
          <p className="mt-1 text-xs text-slate-400">Tip: export the public RYA &ldquo;Find a Training Centre&rdquo; list to a spreadsheet, save as CSV, and paste it here.</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} placeholder={"name,region,city,postcode,email,contact,role\nExample SC,South West,Exampleton,EX1 1AA,info@ex.test,A. Person,Principal"} className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none focus:border-teal" />
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
