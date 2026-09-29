import type { CloudflareEnv } from "@/lib/cf/bindings";
import { createStripe } from "./stripe";

export interface InvoiceRow {
  id: string;
  number: string;
  created: number; // epoch ms
  amountPaid: number; // major units
  currency: string;
  status: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

/**
 * A centre's Stripe invoices (VAT invoices Stripe issues for every payment).
 * `pdfUrl` is Stripe's downloadable PDF; `hostedUrl` is the online copy. Stripe
 * also emails these automatically when invoice emails are enabled in the
 * dashboard. Read-only.
 */
export async function listInvoices(env: CloudflareEnv, customerId: string, limit = 24): Promise<InvoiceRow[]> {
  const stripe = createStripe(env);
  const res = await stripe.invoices.list({ customer: customerId, limit });
  return res.data.map((i) => ({
    id: i.id ?? "",
    number: i.number ?? i.id ?? "",
    created: (i.created ?? 0) * 1000,
    amountPaid: (i.amount_paid ?? 0) / 100,
    currency: (i.currency ?? "gbp").toUpperCase(),
    status: i.status ?? "",
    hostedUrl: i.hosted_invoice_url ?? null,
    pdfUrl: i.invoice_pdf ?? null,
  }));
}
