import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { CATEGORY_BY_KEY, GROUP_LABEL } from "@/lib/finance/categories";
import { buildPnl, fyRange, toReporting } from "@/lib/finance/pnl";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const major = (minor: number) => (minor / 100).toFixed(2);

/** Accountant-ready CSVs: every line of the year, or the P&L summary. */
export async function GET(req: Request) {
  await requirePlatformAdmin();
  const url = new URL(req.url);
  const platform = new PlatformRepository(await getDb());
  const settings = await platform.getFinanceSettings();
  const fy = /^\d{4}$/.test(url.searchParams.get("fy") ?? "") ? Number(url.searchParams.get("fy")) : new Date().getUTCFullYear();
  const { from, to, label } = fyRange(fy, settings.fyStartMonth);
  const kind = url.searchParams.get("kind") === "pnl" ? "pnl" : "transactions";
  const all = await platform.listFinanceTransactions();
  const cur = settings.reportingCurrency;
  let lines: string[];
  if (kind === "pnl") {
    const p = buildPnl(all, settings, fy);
    lines = [["Section", "Line", `Amount (${cur})`].map(cell).join(",")];
    for (const g of p.groups) {
      for (const l of g.lines) lines.push([GROUP_LABEL[g.group], l.label, major(l.amountMinor)].map(cell).join(","));
      lines.push([GROUP_LABEL[g.group], `Total ${GROUP_LABEL[g.group].toLowerCase()}`, major(g.totalMinor)].map(cell).join(","));
    }
    for (const [k, v] of [["Gross profit", p.grossProfitMinor], ["Operating profit", p.operatingProfitMinor], ["Interest income/(expense)", p.interestMinor], ["R&D tax credit", p.rdCreditMinor], ["Profit before tax", p.profitBeforeTaxMinor], ["Corporation tax", p.corporationTaxMinor], ["Retained profit", p.retainedProfitMinor]] as const) {
      lines.push(["Bottom line", k, major(v)].map(cell).join(","));
    }
  } else {
    lines = [["Date", "Section", "Category", "Description", "Supplier/customer", "Amount", "VAT", "Currency", `Amount (${cur})`, "Source", "Reference", "Notes"].map(cell).join(",")];
    for (const t of all.filter((t) => t.date >= from && t.date < to).sort((a, b) => a.date.localeCompare(b.date))) {
      const c = CATEGORY_BY_KEY[t.category];
      lines.push([t.date, c ? GROUP_LABEL[c.group] : "", c?.label ?? t.category, t.description, t.counterparty, major(t.amountMinor), t.vatMinor != null ? major(t.vatMinor) : "", t.currency, major(toReporting(t.amountMinor, t.currency, settings)), t.source, t.receiptRef, t.notes].map(cell).join(","));
    }
  }
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activityroster-${kind}-FY${label.replace("/", "-")}.csv"` },
  });
}
