"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTransactionAction, deleteTransactionAction, syncStripeAction, updateFinanceSettingsAction, updateTransactionAction, type FinanceResult } from "@/app/admin/finance/actions";
import { FINANCE_CATEGORIES, GROUP_LABEL, type FinanceGroup } from "@/lib/finance/categories";

const initial: FinanceResult = { ok: false };
const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
const GROUPS: FinanceGroup[] = ["cost_of_sales", "operating", "revenue", "below_the_line"];

function CategorySelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [val, setVal] = useState(defaultValue ?? "");
  const hint = FINANCE_CATEGORIES.find((c) => c.key === val)?.hint;
  return (
    <div>
      <select name={name} value={val} onChange={(e) => setVal(e.target.value)} required className={field}>
        <option value="">Category…</option>
        {GROUPS.map((g) => (
          <optgroup key={g} label={GROUP_LABEL[g]}>
            {FINANCE_CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </optgroup>
        ))}
      </select>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function TxFields({ defaults }: { defaults?: Partial<Record<"date" | "category" | "description" | "counterparty" | "amount" | "vat" | "currency" | "receiptRef" | "notes", string>> }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Date<input type="date" name="date" defaultValue={defaults?.date ?? today} required className={`mt-1 ${field}`} /></label>
      <div className="sm:col-span-4"><span className="text-xs font-medium text-slate-500">Category</span><div className="mt-1"><CategorySelect name="category" defaultValue={defaults?.category} /></div></div>
      <label className="text-xs font-medium text-slate-500 sm:col-span-4">What for<input name="description" defaultValue={defaults?.description} required maxLength={200} placeholder="e.g. Cloudflare Workers, September" className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Supplier / customer<input name="counterparty" defaultValue={defaults?.counterparty} maxLength={120} className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Amount (incl. VAT)<input name="amount" defaultValue={defaults?.amount} required inputMode="decimal" placeholder="12.50" className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500">Currency<select name="currency" defaultValue={defaults?.currency ?? "GBP"} className={`mt-1 ${field}`}><option>GBP</option><option>EUR</option></select></label>
      <label className="text-xs font-medium text-slate-500">VAT in that<input name="vat" defaultValue={defaults?.vat} inputMode="decimal" placeholder="optional" className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Receipt / invoice ref or link<input name="receiptRef" defaultValue={defaults?.receiptRef} maxLength={300} className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-6">Notes<input name="notes" defaultValue={defaults?.notes} maxLength={1000} className={`mt-1 ${field}`} /></label>
    </div>
  );
}

/** Add a transaction by hand. */
export function AddTransactionForm() {
  const [state, action, pending] = useActionState(addTransactionAction, initial);
  return (
    <form action={action} key={state.ok ? String(Date.now()) : "form"} className="space-y-3">
      <TxFields />
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Adding…" : "Add to the books"}</button>
        {state.error ? <span className="text-sm text-port">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-starboard">{state.message}</span> : null}
      </div>
      <p className="text-[11px] text-slate-400">Costs are entered as positive amounts. A refund or a gain is a negative amount in the same category.</p>
    </form>
  );
}

export interface TxRow {
  id: string; date: string; category: string; categoryLabel: string; group: string; description: string; counterparty: string | null;
  amountMinor: number; vatMinor: number | null; currency: "GBP" | "EUR"; source: "manual" | "stripe"; receiptRef: string | null; notes: string | null;
}

/** The log: edit in place, delete, filter by group/category. */
export function TransactionTable({ rows }: { rows: TxRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmt = (minor: number, cur: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(minor / 100);
  const visible = rows.filter((r) => (!filter || r.group === filter || r.category === filter) && (!q || `${r.description} ${r.counterparty ?? ""} ${r.categoryLabel}`.toLowerCase().includes(q.toLowerCase())));

  const save = (id: string, form: HTMLFormElement) => start(async () => {
    const r = await updateTransactionAction(id, new FormData(form));
    setMsg(r.ok ? "Saved" : r.error ?? "Could not save");
    if (r.ok) { setEditing(null); router.refresh(); }
  });
  const del = (id: string) => { if (!confirm("Delete this line? Your accountant will not see it.")) return; start(async () => { const r = await deleteTransactionAction(id); setMsg(r.ok ? "Deleted" : r.error ?? "Failed"); router.refresh(); }); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal" aria-label="Search transactions" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" aria-label="Filter">
          <option value="">All lines</option>
          {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
          <optgroup label="One category">{FINANCE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</optgroup>
        </select>
        <span className="text-xs text-slate-400">{visible.length} of {rows.length}</span>
        {msg ? <span className="ml-auto text-xs text-slate-500" role="status">{msg}</span> : null}
      </div>
      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">What for</th><th className="px-3 py-2">Who</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">VAT</th><th className="px-3 py-2">Ref</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">Nothing here yet.</td></tr> : visible.map((r) => (
              editing === r.id ? (
                <tr key={r.id} className="bg-teal/5">
                  <td colSpan={8} className="px-3 py-3">
                    <form onSubmit={(e) => { e.preventDefault(); save(r.id, e.currentTarget); }} className="space-y-3">
                      <TxFields defaults={{ date: r.date, category: r.category, description: r.description, counterparty: r.counterparty ?? "", amount: (r.amountMinor / 100).toFixed(2), vat: r.vatMinor != null ? (r.vatMinor / 100).toFixed(2) : "", currency: r.currency, receiptRef: r.receiptRef ?? "", notes: r.notes ?? "" }} />
                      <div className="flex gap-3"><button disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-500">Cancel</button></div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.date}</td>
                  <td className="px-3 py-2 text-slate-700">{r.categoryLabel}</td>
                  <td className="px-3 py-2 text-navy">{r.description}{r.source === "stripe" ? <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">Stripe</span> : null}</td>
                  <td className="px-3 py-2 text-slate-500">{r.counterparty ?? "—"}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${r.group === "revenue" ? "text-starboard" : "text-navy"}`}>{fmt(r.amountMinor, r.currency)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">{r.vatMinor != null ? fmt(r.vatMinor, r.currency) : "—"}</td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-slate-500">{r.receiptRef?.startsWith("http") ? <a href={r.receiptRef} target="_blank" rel="noreferrer" className="text-teal hover:underline">link</a> : r.receiptRef ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    <button onClick={() => { setEditing(r.id); setMsg(null); }} className="text-teal hover:underline">Edit</button>
                    <button onClick={() => del(r.id)} className="ml-2 text-slate-400 hover:text-port">Delete</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FinanceSettingsForm({ fyStartMonth, reportingCurrency, eurToGbp, openingCash, openingCashDate }: { fyStartMonth: number; reportingCurrency: string; eurToGbp: number; openingCash: string; openingCashDate: string }) {
  const [state, action, pending] = useActionState(updateFinanceSettingsAction, initial);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <label className="text-xs font-medium text-slate-500">Financial year starts<select name="fyStartMonth" defaultValue={fyStartMonth} className={`mt-1 ${field}`}>{months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
      <label className="text-xs font-medium text-slate-500">Report in<select name="reportingCurrency" defaultValue={reportingCurrency} className={`mt-1 ${field}`}><option>GBP</option><option>EUR</option></select></label>
      <label className="text-xs font-medium text-slate-500">1 EUR = ? GBP<input name="eurToGbp" defaultValue={eurToGbp} inputMode="decimal" className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500">Opening bank balance<input name="openingCash" defaultValue={openingCash} inputMode="decimal" placeholder="0.00" className={`mt-1 ${field}`} /></label>
      <label className="text-xs font-medium text-slate-500">…as at<input type="date" name="openingCashDate" defaultValue={openingCashDate} className={`mt-1 ${field}`} /></label>
      <div className="flex items-center gap-3 sm:col-span-5">
        <button disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">{pending ? "Saving…" : "Save settings"}</button>
        {state.error ? <span className="text-sm text-port">{state.error}</span> : null}{state.ok ? <span className="text-sm text-starboard">{state.message}</span> : null}
      </div>
    </form>
  );
}

export function StripeSyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [since, setSince] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-label="From date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      <button type="button" onClick={() => start(async () => { const r = await syncStripeAction(since || undefined); setMsg(r.ok ? r.message ?? "Done" : r.error ?? "Failed"); router.refresh(); })} disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">{pending ? "Checking Stripe…" : "Pull paid invoices from Stripe"}</button>
      {msg ? <span className="text-xs text-slate-500" role="status">{msg}</span> : null}
    </div>
  );
}
