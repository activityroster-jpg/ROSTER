import type Stripe from "stripe";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Repositories } from "@/lib/db/repositories";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { Database } from "@/lib/db/client";
import { createStripe } from "./stripe";

const SETUP_WORDS = /setup|set-up|custom package|onsite|on-site|consultancy/i;
const iso = (epochS: number) => new Date(epochS * 1000).toISOString().slice(0, 10);
const cur = (c: string | null | undefined): "GBP" | "EUR" => ((c ?? "gbp").toUpperCase() === "EUR" ? "EUR" : "GBP");

function revenueCategory(inv: Stripe.Invoice): string {
  const text = inv.lines?.data.map((l) => `${l.description ?? ""} ${typeof l.price === "object" && l.price ? l.price.nickname ?? "" : ""}`).join(" ") ?? "";
  return SETUP_WORDS.test(text) ? "setup_revenue" : "subscription_revenue";
}

/**
 * Book a paid Stripe invoice: the revenue line, and Stripe's fee as a payment
 * processing cost. Idempotent on the invoice id. Returns how many rows were new.
 */
export async function recordInvoicePaid(db: Database, repos: Repositories, env: CloudflareEnv, inv: Stripe.Invoice): Promise<number> {
  if (!inv.id || !inv.amount_paid) return 0;
  const platform = new PlatformRepository(db);
  const customerId = typeof inv.customer === "string" ? inv.customer : null;
  const org = customerId ? await repos.control.organisationByStripeCustomer(customerId) : null;
  const counterparty = org?.name ?? inv.customer_email ?? inv.customer_name ?? "Stripe customer";
  const date = iso(inv.status_transitions?.paid_at ?? inv.created);
  let created = 0;
  const rev = await platform.upsertFinanceByExternalId({
    date,
    category: revenueCategory(inv),
    description: `Stripe invoice ${inv.number ?? inv.id}`,
    counterparty,
    amountMinor: inv.amount_paid,
    vatMinor: inv.tax ?? null,
    currency: cur(inv.currency),
    source: "stripe",
    externalId: inv.id,
    receiptRef: inv.hosted_invoice_url ?? null,
    notes: null,
  });
  if (rev.created) created++;

  // Stripe's fee lives on the charge's balance transaction.
  const chargeId = typeof inv.charge === "string" ? inv.charge : null;
  if (chargeId) {
    try {
      const charge = await createStripe(env).charges.retrieve(chargeId, { expand: ["balance_transaction"] });
      const bt = charge.balance_transaction;
      if (bt && typeof bt === "object" && bt.fee > 0) {
        const fee = await platform.upsertFinanceByExternalId({
          date,
          category: "payment_processing",
          description: `Stripe fee on invoice ${inv.number ?? inv.id}`,
          counterparty: "Stripe",
          amountMinor: bt.fee,
          vatMinor: null,
          currency: cur(bt.currency),
          source: "stripe",
          externalId: `${inv.id}:fee`,
          receiptRef: null,
          notes: null,
        });
        if (fee.created) created++;
      }
    } catch (err) {
      console.error("[finance] fee lookup failed:", (err as Error).message);
    }
  }
  return created;
}

/** A refund reverses the revenue line (negative amount, same category). Idempotent per refund. */
export async function recordChargeRefunded(db: Database, repos: Repositories, charge: Stripe.Charge): Promise<number> {
  const platform = new PlatformRepository(db);
  const invoiceId = typeof charge.invoice === "string" ? charge.invoice : null;
  const refunds = charge.refunds?.data ?? [];
  let created = 0;
  for (const r of refunds) {
    if (!r.amount) continue;
    const customerId = typeof charge.customer === "string" ? charge.customer : null;
    const org = customerId ? await repos.control.organisationByStripeCustomer(customerId) : null;
    const res = await platform.upsertFinanceByExternalId({
      date: iso(r.created),
      category: "subscription_revenue",
      description: `Refund${invoiceId ? ` of invoice ${invoiceId}` : ""}`,
      counterparty: org?.name ?? "Stripe customer",
      amountMinor: -r.amount,
      vatMinor: null,
      currency: cur(r.currency),
      source: "stripe",
      externalId: `refund:${r.id}`,
      receiptRef: null,
      notes: null,
    });
    if (res.created) created++;
  }
  return created;
}

/**
 * Pull every paid invoice from Stripe into the books (for history before this
 * feature existed, or if a webhook was missed). Safe to run repeatedly.
 */
export async function backfillStripeRevenue(db: Database, repos: Repositories, env: CloudflareEnv, sinceIso?: string): Promise<{ invoices: number; created: number }> {
  const stripe = createStripe(env);
  const created_gte = sinceIso ? Math.floor(new Date(`${sinceIso}T00:00:00Z`).getTime() / 1000) : undefined;
  let starting_after: string | undefined;
  let invoices = 0;
  let created = 0;
  for (let page = 0; page < 20; page++) {
    const res = await stripe.invoices.list({ status: "paid", limit: 100, starting_after, ...(created_gte ? { created: { gte: created_gte } } : {}) });
    for (const inv of res.data) {
      invoices++;
      created += await recordInvoicePaid(db, repos, env, inv);
    }
    if (!res.has_more || res.data.length === 0) break;
    starting_after = res.data[res.data.length - 1]!.id;
  }
  return { invoices, created };
}
