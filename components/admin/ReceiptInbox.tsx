"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { addTransactionAction, type FinanceResult } from "@/app/admin/finance/actions";
import { attachInboxAction, deleteInboxAction, dismissInboxAction, rereadInboxAction, saveForwardingAction } from "@/app/admin/finance/inbox-actions";
import { CATEGORY_BY_KEY } from "@/lib/finance/categories";
import { TxFields } from "./FinanceForms";

export interface LineOption { id: string; date: string; description: string; counterparty: string | null; amountMinor: number; currency: string }

export interface InboxItem {
  id: string; receivedAt: string; status: "pending" | "matched" | "dismissed" | "held" | "gmail";
  fromAddress: string | null; fromName: string | null; subject: string | null;
  fileName: string | null; fileType: string | null; hasFile: boolean;
  readStatus: "unread" | "read" | "failed"; supplier: string | null; receiptDate: string | null;
  totalMinor: number | null; vatMinor: number | null; currency: string | null; summary: string | null; suggestedCategory: string | null; note: string | null;
  suggestions: LineOption[]; line: LineOption | null;
}

interface Props {
  address: string; forwardFrom: string; defaultForwarders: string[];
  gmailCode: { id: string; code: string | null; at: string; hasFile: boolean } | null;
  readingOn: boolean; everArrived: boolean; items: InboxItem[]; lines: LineOption[];
}

const initial: FinanceResult = { ok: false };
const money = (minor: number, cur: string | null) => {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: cur || "GBP" }).format(minor / 100); } catch { return `${(minor / 100).toFixed(2)} ${cur ?? ""}`; }
};
const day = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const lineLabel = (l: LineOption) => `${day(l.date)} · ${l.description}${l.counterparty ? ` (${l.counterparty})` : ""} · ${money(l.amountMinor, l.currency)}`;

/**
 * The Receipt inbox: where receipts forwarded from Gmail arrive, are read, and
 * are attached to their line in the books, by themselves when the match is
 * certain or here with one click.
 */
export function ReceiptInbox(p: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const waiting = p.items.filter((i) => i.status === "pending");
  const matched = p.items.filter((i) => i.status === "matched").slice(0, 15);
  const held = p.items.filter((i) => i.status === "held");
  const aside = p.items.filter((i) => i.status === "dismissed");
  return (
    <div className="space-y-5">
      <Setup {...p} />
      {msg ? <p role="status" className="text-sm text-slate-600">{msg}</p> : null}

      <section>
        <h2 className="mb-2 font-semibold text-navy">Waiting for you{waiting.length ? ` (${waiting.length})` : ""}</h2>
        {waiting.length === 0 ? (
          <p className="rounded-card border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">Nothing waiting. Receipts that match a line are attached by themselves and listed below.</p>
        ) : (
          <div className="space-y-3">{waiting.map((i) => <Waiting key={i.id} item={i} lines={p.lines} onMessage={setMsg} />)}</div>
        )}
      </section>

      {matched.length ? (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Recently attached</h2>
          <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white text-sm">
            {matched.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <FileLink item={i} />
                <span className="text-slate-400">→</span>
                <span className="min-w-0 flex-1 truncate text-navy">{i.line ? lineLabel(i.line) : "a line that has since been deleted"}</span>
                <span className="text-xs text-slate-400">{day(i.receivedAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-400">Wrong line? Open the line under Transactions and press Remove on its receipt: it comes back here.</p>
        </section>
      ) : null}

      {held.length ? (
        <section>
          <h2 className="mb-1 font-semibold text-navy">Held: not from a forwarding address</h2>
          <p className="mb-2 text-xs text-slate-500">These reached the address but weren&apos;t forwarded by one of your addresses under &quot;Who can forward&quot;, so nothing in them was kept or read. If one was yours, add that address under &quot;Who can forward&quot; and forward it again.</p>
          <ItemList items={held} onMessage={setMsg} />
        </section>
      ) : null}

      {aside.length ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-navy">Set aside ({aside.length})</summary>
          <div className="mt-2"><ItemList items={aside} onMessage={setMsg} canRestore /></div>
        </details>
      ) : null}
    </div>
  );
}

function Setup({ address, forwardFrom, defaultForwarders, gmailCode, readingOn, everArrived }: Props) {
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(saveForwardingAction, initial);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select it by hand */ }
  };
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-navy">Your receipts address</h2>
      <p className="mt-1 text-xs text-slate-500">Anything your Gmail forwards here is read, and attached to its line when the amount, date and supplier all agree. Keep it private: it is only for your receipts.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="select-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-navy">{address}</code>
        <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50">{copied ? "Copied" : "Copy"}</button>
      </div>
      {gmailCode ? (
        <p className="mt-3 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-sm text-navy">
          Gmail&apos;s confirmation code{gmailCode.code ? <>: <b className="select-all font-mono text-base">{gmailCode.code}</b></> : <> arrived, but the code couldn&apos;t be picked out. {gmailCode.hasFile ? <a href={`/api/admin/finance/inbox?id=${encodeURIComponent(gmailCode.id)}`} target="_blank" rel="noreferrer" className="font-medium text-teal hover:underline">Open Google&apos;s email</a> : null}</>} <span className="text-xs text-slate-500">({day(gmailCode.at)})</span>
        </p>
      ) : null}
      {!readingOn ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Reading is off because no Anthropic key is set. Receipts still arrive and you can match them by hand.</p> : null}

      <details className="mt-3" open={!everArrived}>
        <summary className="cursor-pointer text-sm font-semibold text-teal">How to set it up (about 5 minutes, once)</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li><b>Cloudflare:</b> open the <b>activityroster.com</b> zone → <b>Email Routing</b> → <b>Routing rules</b> → <b>Create routing rule</b>. Enter the part before the @ (<code className="text-xs">{address.split("@")[0]}</code>), set <b>Action</b> to <b>Send to a Worker</b>, choose <b>roster-mail-in</b>, and <b>Save</b>. Your other addresses and catch-all are untouched.</li>
          <li><b>Gmail:</b> <b>Settings</b> (cog) → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b> → <b>Add a forwarding address</b> → paste the address above → <b>Next</b> → <b>Proceed</b>.</li>
          <li>Google sends a confirmation code to the address. Refresh this page: the code appears above within a minute. Type it into Gmail and press <b>Verify</b>. Leave &quot;Disable forwarding&quot; selected there: you only want the filter to forward, not all your mail.</li>
          <li><b>Your receipts filter:</b> Gmail → <b>Settings</b> → <b>Filters and Blocked Addresses</b> → <b>edit</b> your receipts filter → <b>Continue</b> → tick <b>Forward it to</b> and pick the address → <b>Update filter</b>.</li>
          <li>Filters only forward new mail. To bring in older receipts, open each one and forward it to the address by hand.</li>
        </ol>
      </details>

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-500">Who can forward
          <input name="forwardFrom" type="text" inputMode="email" defaultValue={forwardFrom} placeholder={defaultForwarders.join(", ") || "you@gmail.com"} maxLength={1000} className="mt-1 block w-[28rem] max-w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal" />
        </label>
        <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:bg-slate-50 disabled:opacity-50">Save</button>
        <span className="text-xs text-slate-400">{state.message ?? state.error ?? (forwardFrom ? "Separate several with commas." : "Several? Separate them with commas. Blank: your Dev Center login addresses.")}</span>
      </form>
    </div>
  );
}

function FileLink({ item }: { item: InboxItem }) {
  if (!item.hasFile) return <span className="text-slate-400">{item.subject ?? "(no subject)"}</span>;
  const icon = item.fileType === "application/pdf" ? "📄" : item.fileType === "text/html" ? "✉️" : "🖼";
  return (
    <a href={`/api/admin/finance/inbox?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer" className="max-w-[16rem] truncate font-medium text-teal hover:underline" title={item.subject ?? undefined}>
      {icon} {item.fileType === "text/html" ? item.subject ?? "The email" : item.fileName}
    </a>
  );
}

function Waiting({ item, lines, onMessage }: { item: InboxItem; lines: LineOption[]; onMessage: (m: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");
  const [adding, setAdding] = useState(false);
  const run = (f: () => Promise<FinanceResult>) => start(async () => { const r = await f(); onMessage(r.ok ? r.message ?? "Done" : r.error ?? "Something went wrong"); router.refresh(); });
  const sameCurrency = item.currency ? lines.filter((l) => l.currency === item.currency) : lines;
  const ordered = [...sameCurrency].sort((a, b) => item.totalMinor == null ? b.date.localeCompare(a.date) : Math.abs(a.amountMinor - item.totalMinor) - Math.abs(b.amountMinor - item.totalMinor)).slice(0, 40);
  const read = item.readStatus === "read";
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <FileLink item={item} />
          <p className="mt-0.5 truncate text-xs text-slate-500">From {item.fromName ? `${item.fromName} ` : ""}{item.fromAddress ? `<${item.fromAddress}>` : ""} · arrived {day(item.receivedAt)}</p>
        </div>
        {read && item.totalMinor != null ? (
          <div className="text-right">
            <p className="text-lg font-semibold text-navy">{money(item.totalMinor, item.currency)}</p>
            <p className="text-xs text-slate-500">{item.vatMinor != null ? `VAT ${money(item.vatMinor, item.currency)} · ` : ""}{item.receiptDate ? day(item.receiptDate) : "no date"}</p>
          </div>
        ) : null}
      </div>
      {read ? <p className="mt-1 text-sm text-navy">{item.supplier ?? "Supplier not shown"}{item.summary ? <span className="text-slate-500"> · {item.summary}</span> : null}</p> : null}
      {item.note ? <p className="mt-1 text-xs text-amber-700">{item.note}</p> : null}

      <div className="mt-3 space-y-2">
        {item.suggestions.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Same amount:</span>
            {item.suggestions.map((l) => (
              <button key={l.id} type="button" disabled={pending} onClick={() => run(() => attachInboxAction(item.id, l.id))} className="rounded-full border border-teal/40 bg-teal/5 px-3 py-1 text-xs font-medium text-teal hover:bg-teal/10 disabled:opacity-50">
                Attach to {lineLabel(l)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick a line" className="max-w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs sm:max-w-md">
            <option value="">Pick a line without a receipt…</option>
            {ordered.map((l) => <option key={l.id} value={l.id}>{lineLabel(l)}</option>)}
          </select>
          <button type="button" disabled={!pick || pending} onClick={() => run(() => attachInboxAction(item.id, pick))} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Attach</button>
          <span className="text-xs text-slate-300">or</span>
          <button type="button" onClick={() => setAdding((a) => !a)} className="text-xs font-semibold text-teal hover:underline">{adding ? "Close" : "Add as a new line"}</button>
          <span className="ml-auto flex gap-3 text-xs">
            {item.hasFile && item.readStatus !== "read" ? <button type="button" disabled={pending} onClick={() => run(() => rereadInboxAction(item.id))} className="text-slate-500 hover:text-navy">Read again</button> : null}
            <button type="button" disabled={pending} onClick={() => run(() => dismissInboxAction(item.id))} className="text-slate-400 hover:text-port">Set aside</button>
          </span>
        </div>
        {adding ? <AddFromReceipt item={item} onDone={(m) => { setAdding(false); onMessage(m); router.refresh(); }} /> : null}
      </div>
    </div>
  );
}

/** "Add as a new line", filled in from the receipt; the receipt goes on the new line. */
function AddFromReceipt({ item, onDone }: { item: InboxItem; onDone: (m: string) => void }) {
  const [state, action, pending] = useActionState(addTransactionAction, initial);
  useEffect(() => { if (state.ok) onDone(state.message ?? "Added"); }, [state, onDone]);
  const category = item.suggestedCategory && CATEGORY_BY_KEY[item.suggestedCategory] ? item.suggestedCategory : "";
  return (
    <form action={action} className="space-y-3 rounded-lg border border-teal/30 bg-teal/5 p-3">
      <input type="hidden" name="inboxId" value={item.id} />
      <TxFields defaults={{
        date: item.receiptDate ?? item.receivedAt.slice(0, 10), category, description: item.summary ?? item.subject?.slice(0, 200) ?? "",
        counterparty: item.supplier ?? item.fromName ?? "", amount: item.totalMinor != null ? (item.totalMinor / 100).toFixed(2) : "",
        vat: item.vatMinor != null ? (item.vatMinor / 100).toFixed(2) : "", currency: item.currency === "EUR" ? "EUR" : "GBP",
      }} />
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="paidPersonally" className="mt-0.5" />
        <span>The director paid this from their own money (adds the matching director&apos;s loan line).</span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Add line with this receipt</button>
        {state.error ? <span className="text-xs text-port">{state.error}</span> : null}
      </div>
    </form>
  );
}

function ItemList({ items, onMessage, canRestore }: { items: InboxItem[]; onMessage: (m: string) => void; canRestore?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (f: () => Promise<FinanceResult>) => start(async () => { const r = await f(); onMessage(r.ok ? r.message ?? "Done" : r.error ?? "Something went wrong"); router.refresh(); });
  const del = async (id: string) => { if (await askConfirm("Delete this for good? Its file is deleted too.")) run(() => deleteInboxAction(id)); };
  return (
    <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white text-sm">
      {items.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <FileLink item={i} />
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{i.fromAddress ?? ""}{i.note ? ` · ${i.note}` : ""}</span>
          <span className="text-xs text-slate-400">{day(i.receivedAt)}</span>
          {canRestore ? <button type="button" disabled={pending} onClick={() => run(() => dismissInboxAction(i.id, true))} className="text-xs text-teal hover:underline">Back to inbox</button> : null}
          <button type="button" disabled={pending} onClick={() => del(i.id)} className="text-xs text-slate-400 hover:text-port">Delete</button>
        </li>
      ))}
    </ul>
  );
}
