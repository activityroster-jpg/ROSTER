/**
 * Matching an emailed receipt to a line in the books. Pure: no database, no I/O.
 *
 * A line is a candidate when it has no receipt yet, is in the same currency,
 * has exactly the receipt's total (lines are stored including VAT, like
 * receipts), and is dated within a week of the receipt. The receipt is attached
 * on its own only when exactly one line is a candidate AND that line names the
 * same supplier (by the supplier's name or the sender's web domain, or a
 * domain an earlier receipt from that supplier was matched to). A receipt in a
 * currency none of the lines in its week use (US$ on a sterling card) matches
 * on supplier and date alone, and is attached when exactly one line fits.
 * Anything less certain is left for the owner, likeliest lines first.
 */

export interface ReceiptFacts {
  totalMinor: number | null;
  currency: string | null;
  /** The date on the receipt, or the day it arrived when it has none (YYYY-MM-DD). */
  date: string;
  supplier: string | null;
  /** The sender's email address, e.g. "no-reply@aws.amazon.com". */
  fromAddress: string | null;
}

export interface LineFacts {
  id: string;
  date: string;
  amountMinor: number;
  currency: string;
  counterparty: string | null;
  description: string;
  hasReceipt: boolean;
}

export interface MatchResult {
  /** The line to attach to without asking, or null. */
  auto: string | null;
  /** Lines worth offering, best first (same amount and currency; supplier and date order them). */
  suggestions: string[];
}

export const MATCH_WINDOW_DAYS = 7;

/** Words that say nothing about who the supplier is. */
const NOISE = new Set([
  "the", "and", "ltd", "limited", "inc", "llc", "plc", "gmbh", "co", "com", "net", "org", "uk", "ie", "www", "mail", "email", "no", "reply", "noreply",
  "receipt", "receipts", "invoice", "invoices", "billing", "payments", "payment", "order", "orders", "support", "team", "services", "service", "store",
]);

export function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** The words that identify a supplier: "Amazon Web Services EMEA SARL" → amazon, web, sarl… */
export function supplierWords(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !NOISE.has(w)))];
}

/** The meaningful labels of the sender's domain: "no-reply@aws.amazon.com" → aws, amazon. */
export function domainWords(address: string | null | undefined): string[] {
  const domain = address?.split("@")[1]?.toLowerCase();
  if (!domain) return [];
  const labels = domain.split(".");
  // Drop the public suffix (com, co.uk, ie…): the last label, and "co"/"com" before a country code.
  labels.pop();
  if (labels.length > 1 && ["co", "com", "org", "net", "ac", "gov"].includes(labels[labels.length - 1]!)) labels.pop();
  return labels.filter((l) => l.length >= 3 && !NOISE.has(l));
}

export function senderDomain(address: string | null | undefined): string | null {
  return address?.split("@")[1]?.toLowerCase() ?? null;
}

/**
 * Does this line name the receipt's supplier? `known` maps a sender domain to
 * the counterparty names its earlier receipts were matched to.
 */
export function namesSupplier(line: Pick<LineFacts, "counterparty" | "description">, receipt: Pick<ReceiptFacts, "supplier" | "fromAddress">, known: ReadonlyMap<string, readonly string[]> = new Map()): boolean {
  const lineWords = new Set([...supplierWords(line.counterparty), ...supplierWords(line.description)]);
  if (lineWords.size === 0) return false;
  const domain = senderDomain(receipt.fromAddress);
  const remembered = domain ? (known.get(domain) ?? []).flatMap((n) => supplierWords(n)) : [];
  const theirs = [...supplierWords(receipt.supplier), ...domainWords(receipt.fromAddress), ...remembered];
  return theirs.some((w) => lineWords.has(w));
}

export function matchReceipt(receipt: ReceiptFacts, lines: readonly LineFacts[], known: ReadonlyMap<string, readonly string[]> = new Map()): MatchResult {
  if (receipt.totalMinor == null || !receipt.currency) return { auto: null, suggestions: [] };
  const currency = receipt.currency.toUpperCase();
  const open = lines.filter((l) => !l.hasReceipt && daysBetween(l.date, receipt.date) <= MATCH_WINDOW_DAYS);
  const exact = open
    .filter((l) => l.currency === currency && l.amountMinor === receipt.totalMinor)
    .map((l) => ({ id: l.id, supplier: namesSupplier(l, receipt, known), days: daysBetween(l.date, receipt.date) }))
    .sort((a, b) => Number(b.supplier) - Number(a.supplier) || a.days - b.days);
  // A receipt in another currency (a US$ invoice paid on a sterling card) can't
  // match on amount: match on the supplier and the date instead.
  const foreign = open.some((l) => l.currency === currency) ? [] : open
    .filter((l) => namesSupplier(l, receipt, known))
    .map((l) => ({ id: l.id, days: daysBetween(l.date, receipt.date) }))
    .sort((a, b) => a.days - b.days);
  const only = exact.length === 1 ? exact[0]! : null;
  const auto = only?.supplier ? only.id : exact.length === 0 && foreign.length === 1 ? foreign[0]!.id : null;
  const suggestions = [...exact.map((c) => c.id), ...foreign.map((c) => c.id).filter((id) => !exact.some((c) => c.id === id))];
  return { auto, suggestions };
}
