import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { OutreachCampaign, OutreachLead } from "@/lib/db/schema";
import type { ResearchResult, SequenceStep } from "./types";

export interface Composed { subject: string; text: string; html: string; usedAi: boolean }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function firstName(full: string | null | undefined): string | null {
  const n = (full ?? "").trim();
  if (!n) return null;
  const first = n.split(/\s+/)[0]!;
  return /^(mr|mrs|ms|dr|miss)\.?$/i.test(first) ? n.split(/\s+/)[1] ?? null : first;
}

export function renderTemplate(tpl: string, vars: Record<string, string | null | undefined>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars[k] ?? "").toString()).replace(/\n{3,}/g, "\n\n").trim();
}

/** The compliance footer every outreach email ends with. */
export function footerText(opts: { senderName: string; company: string; address: string; unsubscribeUrl: string }): string {
  return `\n\n—\n${opts.senderName}, ${opts.company}\n${opts.address}\nNot the right person, or not relevant? Reply "no thanks" or opt out here: ${opts.unsubscribeUrl}`;
}

export function toHtml(text: string): string {
  const paras = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`);
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:600px">${paras.join("")}</div>`;
}

const DraftSchema = z.object({
  subject: z.string().max(90),
  body: z.string().describe("Plain text, no HTML, no sign-off block (we add it), UK English."),
});

/**
 * Write one email of the sequence. With a Claude key and AI on, the template is
 * guidance and the research supplies a real detail; otherwise the template is
 * rendered verbatim. The footer with the opt-out link is always appended here.
 */
export async function composeEmail(input: {
  campaign: OutreachCampaign;
  lead: OutreachLead;
  step: SequenceStep;
  stepIndex: number;
  research: ResearchResult | null;
  previous: { subject: string; text: string }[];
  unsubscribeUrl: string;
  company: string;
  address: string;
  apiKey?: string;
}): Promise<Composed> {
  const { campaign, lead, step } = input;
  const first = firstName(lead.contactName) ?? "there";
  const hook = input.research?.hooks[0] ?? "";
  const vars = { centre: lead.centreName, first_name: first, contact_name: lead.contactName ?? "", region: lead.region ?? "", sender: campaign.fromName.split(" at ")[0]!.trim(), hook };
  let subject = renderTemplate(step.subject, vars);
  let body = renderTemplate(step.body, vars);
  let usedAi = false;

  if (campaign.aiPersonalise && input.apiKey) {
    try {
      const client = new Anthropic({ apiKey: input.apiKey });
      const r = input.research;
      const context = [
        `Centre: ${lead.centreName}${lead.region ? ` (${lead.region})` : ""}`,
        `Recipient: ${lead.contactName ?? "unknown name"}${lead.contactRole ? `, ${lead.contactRole}` : ""} — address with first name "${first}" (or "Hi there" if unknown)`,
        r?.summary ? `What we know: ${r.summary}` : "What we know: nothing beyond the name",
        r?.hooks.length ? `Specific details we can mention (only if natural): ${r.hooks.join(" | ")}` : "No specific details — do not invent any",
        input.previous.length ? `Earlier emails in this thread:\n${input.previous.map((p, i) => `--- ${i + 1}: ${p.subject}\n${p.text}`).join("\n")}` : "This is the first email.",
      ].join("\n");
      const res = await client.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 1500,
        output_config: { effort: "medium", format: zodOutputFormat(DraftSchema) },
        system: [
          "You write short, honest B2B emails from a small software founder to the person who runs a sailing centre or club in the UK or Ireland.",
          `What we sell: ${campaign.pitch}`,
          `Tone notes from the sender: ${campaign.tone?.trim() || "warm, direct, no hype, no exclamation marks, no buzzwords"}.`,
          "Rules: under 120 words; plain text; one clear, low-pressure ask; mention at most one specific detail about them and only if it is in the facts given; never invent facts, names or numbers; never claim to have met them or used their services; UK English; no subject-line tricks like RE: unless this is a follow-up in the same thread; do not write a sign-off block, we add it. Do not mention that this was written with AI.",
        ].join("\n"),
        messages: [{ role: "user", content: `Step ${input.stepIndex + 1} of ${JSON.parse(campaign.steps).length}: ${step.purpose}\n\nTemplate to follow loosely:\nSubject: ${subject}\n\n${body}\n\nFacts:\n${context}` }],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        subject = res.parsed_output.subject.trim() || subject;
        body = res.parsed_output.body.trim() || body;
        usedAi = true;
      }
    } catch (err) {
      console.error("[outreach] writer AI failed, using template:", (err as Error).message);
    }
  }
  const text = body + footerText({ senderName: campaign.fromName, company: input.company, address: input.address, unsubscribeUrl: input.unsubscribeUrl });
  return { subject, text, html: toHtml(text), usedAi };
}
