"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv, getRepositories } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { CATEGORY_BY_KEY } from "@/lib/finance/categories";
import { backfillStripeRevenue } from "@/lib/billing/finance-sync";
import { financeSettingsSchema, financeTransactionSchema, firstIssue, idSchema, isoDateSchema } from "@/lib/validation/actions";

export type FinanceResult = { ok: boolean; error?: string; message?: string };

const toMinor = (major: string) => Math.round(Number(major) * 100);

function fromForm(fd: FormData) {
  return financeTransactionSchema.safeParse({
    date: fd.get("date"), category: fd.get("category"), description: fd.get("description"), counterparty: fd.get("counterparty") ?? "",
    amount: fd.get("amount"), vat: fd.get("vat") ?? "", currency: fd.get("currency") ?? "GBP", receiptRef: fd.get("receiptRef") ?? "", notes: fd.get("notes") ?? "",
  });
}

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

/** Add a line to the books by hand (expenses, and any revenue that didn't come through Stripe). */
export async function addTransactionAction(_prev: FinanceResult, fd: FormData): Promise<FinanceResult> {
  const p = await platform();
  const parsed = fromForm(fd);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  if (!CATEGORY_BY_KEY[d.category]) return { ok: false, error: "Pick a category" };
  await p.insertFinanceTransaction({
    date: d.date, category: d.category, description: d.description, counterparty: d.counterparty,
    amountMinor: toMinor(d.amount), vatMinor: d.vat ? toMinor(d.vat) : null, currency: d.currency,
    source: "manual", externalId: null, receiptRef: d.receiptRef, notes: d.notes,
  });
  revalidatePath("/admin/finance");
  return { ok: true, message: "Added" };
}

export async function updateTransactionAction(id: string, fd: FormData): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  const parsed = fromForm(fd);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  if (!CATEGORY_BY_KEY[d.category]) return { ok: false, error: "Pick a category" };
  const row = await p.updateFinanceTransaction(id, {
    date: d.date, category: d.category, description: d.description, counterparty: d.counterparty,
    amountMinor: toMinor(d.amount), vatMinor: d.vat ? toMinor(d.vat) : null, currency: d.currency, receiptRef: d.receiptRef, notes: d.notes,
  });
  if (!row) return { ok: false, error: "Not found" };
  revalidatePath("/admin/finance");
  return { ok: true, message: "Saved" };
}

export async function deleteTransactionAction(id: string): Promise<FinanceResult> {
  const p = await platform();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Not found" };
  const ok = await p.deleteFinanceTransaction(id);
  revalidatePath("/admin/finance");
  return ok ? { ok: true, message: "Deleted" } : { ok: false, error: "Not found" };
}

export async function updateFinanceSettingsAction(_prev: FinanceResult, fd: FormData): Promise<FinanceResult> {
  const p = await platform();
  const parsed = financeSettingsSchema.safeParse({
    fyStartMonth: fd.get("fyStartMonth"), reportingCurrency: fd.get("reportingCurrency"), eurToGbp: fd.get("eurToGbp"),
    openingCash: fd.get("openingCash") ?? "", openingCashDate: fd.get("openingCashDate") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const d = parsed.data;
  await p.upsertFinanceSettings({
    fyStartMonth: d.fyStartMonth, reportingCurrency: d.reportingCurrency, eurToGbp: d.eurToGbp,
    openingCashMinor: d.openingCash ? toMinor(d.openingCash) : 0, openingCashDate: d.openingCashDate || null,
  });
  revalidatePath("/admin/finance");
  return { ok: true, message: "Settings saved" };
}

/** Pull paid Stripe invoices (and their fees) into the books. Safe to repeat. */
export async function syncStripeAction(sinceIso?: string): Promise<FinanceResult> {
  await requirePlatformAdmin();
  if (sinceIso && !isoDateSchema.safeParse(sinceIso).success) return { ok: false, error: "Pick a date" };
  try {
    const r = await backfillStripeRevenue(await getDb(), await getRepositories(), getEnv(), sinceIso || undefined);
    revalidatePath("/admin/finance");
    return { ok: true, message: `${r.invoices} paid invoice${r.invoices === 1 ? "" : "s"} checked · ${r.created} new line${r.created === 1 ? "" : "s"} added` };
  } catch (err) {
    return { ok: false, error: `Stripe sync failed: ${(err as Error).message}` };
  }
}
