import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { FINANCE_CATEGORIES } from "@/lib/finance/categories";

/**
 * Reads a receipt (PDF, photo, or the email itself) for the supplier, date,
 * total, VAT and currency, using Claude. Only the receipt and its email's
 * subject and sender go to Anthropic; these are the company's own supplier
 * receipts, never centre or customer data (docs/subprocessors.md).
 */

const COST_KEYS = FINANCE_CATEGORIES.filter((c) => c.effect === "cost").map((c) => c.key) as [string, ...string[]];

const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe("true if this is a receipt, invoice or payment confirmation for something bought"),
  supplier: z.string().nullable().describe("who was paid, as a short business name, e.g. 'Cloudflare' or 'Amazon Web Services'"),
  date: z.string().nullable().describe("the payment or invoice date, YYYY-MM-DD"),
  total: z.number().nullable().describe("the total paid including VAT, in major units, e.g. 12.5"),
  vat: z.number().nullable().describe("the VAT within the total, in major units, or null if none is shown"),
  currency: z.string().nullable().describe("ISO currency code of the total, e.g. GBP or EUR"),
  summary: z.string().nullable().describe("what was bought, under 60 characters, e.g. 'Workers paid plan, October'"),
  category: z.enum(COST_KEYS).nullable().describe("the best-fitting expense category key"),
});

export interface ReceiptReading {
  isReceipt: boolean;
  supplier: string | null;
  date: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  currency: string | null;
  summary: string | null;
  category: string | null;
}

export interface ReceiptInput {
  fileType: string;
  body: ArrayBuffer;
  subject: string | null;
  fromAddress: string | null;
}

type ImageType = "image/png" | "image/jpeg" | "image/webp";
const IMAGE_TYPES = new Set<string>(["image/png", "image/jpeg", "image/webp"]);

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** An HTML email as plain text, enough to read the figures from. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&pound;/g, "£").replace(/&euro;/g, "€").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 30_000);
}

const toMinor = (n: number | null) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100));

export async function readReceipt(input: ReceiptInput, apiKey: string): Promise<ReceiptReading | null> {
  const client = new Anthropic({ apiKey });
  const context = `Email subject: ${input.subject ?? "(none)"}\nSent by: ${input.fromAddress ?? "(unknown)"}`;
  const content: Anthropic.ContentBlockParam[] =
    input.fileType === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64(input.body) } }]
      : IMAGE_TYPES.has(input.fileType)
        ? [{ type: "image", source: { type: "base64", media_type: input.fileType as ImageType, data: base64(input.body) } }]
        : [{ type: "text", text: `The email:\n${htmlToText(new TextDecoder().decode(input.body))}` }];
  content.push({ type: "text", text: `${context}\n\nRead this receipt. Give only figures you can see; use null for anything not shown. If it is forwarded, the supplier is the original sender, not the person who forwarded it.` });

  const res = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1000,
    output_config: { effort: "low", format: zodOutputFormat(ReceiptSchema) },
    system: "You read purchase receipts and invoices for a small UK software company's bookkeeping. Be exact with amounts and dates. Never guess a figure that is not on the receipt.",
    messages: [{ role: "user", content }],
  });
  const out = res.stop_reason !== "refusal" ? res.parsed_output : null;
  if (!out) return null;
  const date = out.date && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && !Number.isNaN(Date.parse(out.date)) ? out.date : null;
  const currency = out.currency && /^[A-Za-z]{3}$/.test(out.currency.trim()) ? out.currency.trim().toUpperCase() : null;
  return {
    isReceipt: out.isReceipt,
    supplier: out.supplier?.trim().slice(0, 120) || null,
    date,
    totalMinor: toMinor(out.total),
    vatMinor: toMinor(out.vat),
    currency,
    summary: out.summary?.trim().slice(0, 120) || null,
    category: out.category && COST_KEYS.includes(out.category) ? out.category : null,
  };
}
