import type { CloudflareEnv } from "@/lib/cf/bindings";
import type { Database } from "@/lib/db/client";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import type { OutreachCampaign, OutreachLead } from "@/lib/db/schema";
import { sendRawEmail } from "@/lib/mail";
import { COMPANY } from "@/lib/config";
import { composeEmail } from "./writer";
import { pickContact, researchProspect } from "./research";
import { emailLooksDeliverable } from "./validate";
import type { ResearchResult, SequenceStep } from "./types";
import { costMicros, type UsageSink } from "./cost";

export const parseSteps = (c: OutreachCampaign): SequenceStep[] => { try { const s = JSON.parse(c.steps) as SequenceStep[]; return Array.isArray(s) && s.length ? s : []; } catch { return []; } };
export const parseResearch = (l: OutreachLead): ResearchResult | null => { try { return l.research ? (JSON.parse(l.research) as ResearchResult) : null; } catch { return null; } };

const LONDON = "Europe/London";
export function londonParts(d = new Date()): { hour: number; weekday: number; dayKey: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, hour: "numeric", hour12: false, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { hour: Number(get("hour")) % 24, weekday: wd, dayKey: `${get("year")}-${get("month")}-${get("day")}` };
}

/** Is now inside the campaign's sending hours? */
export function windowOpen(c: Pick<OutreachCampaign, "sendWindowStart" | "sendWindowEnd" | "weekdaysOnly">, now = new Date()): boolean {
  const { hour, weekday } = londonParts(now);
  if (c.weekdaysOnly && (weekday === 0 || weekday === 6)) return false;
  return hour >= c.sendWindowStart && hour < c.sendWindowEnd;
}

/** Next send moment that is `gapDays` ahead and inside a window (approximate: start of window that day). */
export function scheduleAfter(c: Pick<OutreachCampaign, "sendWindowStart" | "sendWindowEnd" | "weekdaysOnly">, from: Date, gapDays: number): Date {
  const d = new Date(from.getTime() + gapDays * 86_400_000);
  for (let i = 0; i < 7; i++) {
    const { weekday } = londonParts(d);
    if (!c.weekdaysOnly || (weekday !== 0 && weekday !== 6)) break;
    d.setTime(d.getTime() + 86_400_000);
  }
  return d;
}

export function unsubscribeUrl(env: CloudflareEnv, token: string): string {
  return `https://${env.APP_APEX_DOMAIN}/u/${token}`;
}

/** Records one Claude call against a campaign/lead so the Outreach page can show spend by day, week and month. */
export function usageSink(p: PlatformRepository, ids: { campaignId?: string | null; leadId?: string | null }): UsageSink {
  return async (kind, model, u) => {
    await p.insertAiUsage({ kind, model, campaignId: ids.campaignId ?? null, leadId: ids.leadId ?? null, inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens, cacheWriteTokens: u.cacheWriteTokens, costMicros: costMicros(model, u) });
  };
}

/** Research the next batch of leads in a campaign; those with an address become queued. */
export async function researchBatch(db: Database, env: CloudflareEnv, campaignId: string, limit = 10): Promise<{ researched: number; queued: number; noEmail: number }> {
  const p = new PlatformRepository(db);
  const campaign = await p.getOutreachCampaign(campaignId);
  if (!campaign) return { researched: 0, queued: 0, noEmail: 0 };
  const leads = await p.listOutreachLeads(campaignId, { status: "new", limit });
  let researched = 0, queued = 0, noEmail = 0;
  for (const lead of leads) {
    const r = await researchProspect({ website: lead.website, knownEmail: lead.email, targetRoles: campaign.targetRoles, apiKey: env.ANTHROPIC_API_KEY, onUsage: usageSink(p, { campaignId, leadId: lead.id }) });
    const contact = pickContact(r, campaign.targetRoles);
    const email = r.chosenEmail ?? lead.email?.toLowerCase() ?? null;
    let verified = false;
    if (email) verified = (await emailLooksDeliverable(email)).ok;
    const suppressed = email ? await p.isSuppressed(email) : false;
    const ready = Boolean(email && verified && !suppressed);
    await p.updateOutreachLead(lead.id, {
      research: JSON.stringify(r),
      email,
      emailVerified: verified,
      contactName: lead.contactName ?? contact.name,
      contactRole: lead.contactRole ?? contact.role,
      status: suppressed ? "opted_out" : ready ? "queued" : "no_email",
      nextSendAt: ready ? new Date() : null,
      error: email && !verified ? "Address failed the domain check" : null,
    });
    researched++;
    if (ready) queued++; else noEmail++;
  }
  return { researched, queued, noEmail };
}

export interface SendRunResult { attempted: number; sent: number; skipped: number; failed: number; notes: string[] }

/**
 * Send every email that is due across running campaigns, respecting each
 * campaign's hours and daily cap. Safe to call often: a lead is claimed
 * ("sending") before its message goes out, so overlapping runs never double-send.
 */
export async function runDueSends(db: Database, env: CloudflareEnv, opts: { limit?: number; now?: Date; campaignId?: string; force?: boolean } = {}): Promise<SendRunResult> {
  const p = new PlatformRepository(db);
  const now = opts.now ?? new Date();
  const out: SendRunResult = { attempted: 0, sent: 0, skipped: 0, failed: 0, notes: [] };
  const campaigns = (await p.listOutreachCampaigns()).filter((c) => c.status === "running" && (!opts.campaignId || c.id === opts.campaignId));
  const address = env.COMPANY_ADDRESS || COMPANY.addressInline;
  const company = env.COMPANY_LEGAL_NAME || COMPANY.legalName;
  let budget = opts.limit ?? 25;
  for (const c of campaigns) {
    if (!opts.force && !windowOpen(c, now)) { out.notes.push(`${c.name}: outside sending hours`); continue; }
    const sentToday = await p.countOutreachSentSince(c.id, londonDayStart(now));
    let remaining = Math.max(0, c.dailyCap - sentToday);
    if (remaining === 0) { out.notes.push(`${c.name}: daily cap reached`); continue; }
    const steps = parseSteps(c);
    const due = await p.listDueOutreachLeads(c.id, now, Math.min(remaining, budget));
    for (const lead of due) {
      if (budget <= 0 || remaining <= 0) break;
      out.attempted++;
      const step = steps[lead.stepIndex];
      if (!step || !lead.email) { await p.updateOutreachLead(lead.id, { status: "completed", nextSendAt: null }); out.skipped++; continue; }
      if (await p.isSuppressed(lead.email)) { await p.updateOutreachLead(lead.id, { status: "opted_out", nextSendAt: null }); out.skipped++; continue; }
      const claimed = await p.claimOutreachLead(lead.id);
      if (!claimed) { out.skipped++; continue; }
      try {
        const previous = (await p.listOutreachMessages(lead.id)).map((m) => ({ subject: m.subject, text: m.bodyText }));
        const composed = await composeEmail({ campaign: c, lead, step, stepIndex: lead.stepIndex, research: parseResearch(lead), previous, unsubscribeUrl: unsubscribeUrl(env, lead.unsubscribeToken), company, address, apiKey: env.ANTHROPIC_API_KEY, onUsage: usageSink(p, { campaignId: c.id, leadId: lead.id }) });
        const unsub = unsubscribeUrl(env, lead.unsubscribeToken);
        const res = await sendRawEmail({
          from: `${c.fromName} <${c.fromEmail}>`, to: lead.email, subject: composed.subject, html: composed.html, text: composed.text,
          replyTo: c.replyTo ?? undefined,
          headers: { "List-Unsubscribe": `<${unsub}>, <mailto:${c.replyTo ?? c.fromEmail}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          tags: [{ name: "campaign", value: c.id }, { name: "lead", value: lead.id }],
          stream: "news",
        });
        await p.insertOutreachMessage({ leadId: lead.id, campaignId: c.id, step: lead.stepIndex, toEmail: lead.email, subject: composed.subject, bodyText: composed.text, resendId: res.id, status: "sent", sentAt: now });
        const nextIndex = lead.stepIndex + 1;
        const nextStep = steps[nextIndex];
        await p.updateOutreachLead(lead.id, {
          stepIndex: nextIndex,
          status: nextStep ? "in_sequence" : "completed",
          nextSendAt: nextStep ? scheduleAfter(c, now, Math.max(1, nextStep.gapDays)) : null,
          lastEventAt: now,
          error: res.sent ? null : "Not sent: mail is disabled outside production",
        });
        out.sent++; remaining--; budget--;
      } catch (err) {
        await p.updateOutreachLead(lead.id, { status: "failed", error: (err as Error).message.slice(0, 300) });
        out.failed++;
      }
    }
    if (steps.length && (await p.countOutreachLeads(c.id, ["new", "queued", "in_sequence", "sending", "no_email"])) === 0) {
      await p.updateOutreachCampaign(c.id, { status: "finished" });
      out.notes.push(`${c.name}: finished`);
    }
  }
  return out;
}

/** Start of the current London week (Monday) and month, for the usage tiles. */
export function londonWeekStart(now: Date): Date {
  const day = londonDayStart(now);
  const { weekday } = londonParts(day);
  const back = (weekday + 6) % 7;
  return londonDayStart(new Date(day.getTime() - back * 86_400_000 + 3_600_000));
}
export function londonMonthStart(now: Date): Date {
  const { dayKey } = londonParts(now);
  const first = `${dayKey.slice(0, 7)}-01`;
  return londonDayStart(new Date(`${first}T12:00:00Z`));
}

export function londonDayStart(now: Date): Date {
  const { dayKey } = londonParts(now);
  // Midnight London is 00:00 UTC in winter and 23:00 UTC the previous day in summer:
  // the London hour at 00:00 UTC tells us which (0 or 1).
  const utcMidnight = new Date(`${dayKey}T00:00:00Z`).getTime();
  const { hour } = londonParts(new Date(utcMidnight));
  return new Date(utcMidnight - hour * 3_600_000);
}

/** Resend webhook payload → our records. Idempotent; unknown ids are ignored. */
export async function applyResendEvent(db: Database, type: string, data: { email_id?: string; to?: string[] | string; bounce?: { message?: string } }): Promise<"updated" | "ignored"> {
  const p = new PlatformRepository(db);
  const id = data.email_id;
  if (!id) return "ignored";
  const msg = await p.findOutreachMessageByResendId(id);
  if (!msg) return "ignored";
  const now = new Date();
  switch (type) {
    case "email.delivered": if (msg.status === "sent") await p.updateOutreachMessage(msg.id, { status: "delivered" }); return "updated";
    case "email.opened": await p.updateOutreachMessage(msg.id, { status: msg.status === "clicked" ? "clicked" : "opened", openedAt: msg.openedAt ?? now }); await p.touchOutreachLead(msg.leadId, now); return "updated";
    case "email.clicked": await p.updateOutreachMessage(msg.id, { status: "clicked", clickedAt: now, openedAt: msg.openedAt ?? now }); await p.touchOutreachLead(msg.leadId, now); return "updated";
    case "email.bounced":
      await p.updateOutreachMessage(msg.id, { status: "bounced", error: data.bounce?.message?.slice(0, 300) ?? null });
      await p.updateOutreachLead(msg.leadId, { status: "bounced", nextSendAt: null, lastEventAt: now });
      await p.addSuppression(msg.toEmail, "bounce", data.bounce?.message?.slice(0, 200) ?? null);
      return "updated";
    case "email.complained":
      await p.updateOutreachMessage(msg.id, { status: "complained" });
      await p.updateOutreachLead(msg.leadId, { status: "opted_out", nextSendAt: null, lastEventAt: now });
      await p.addSuppression(msg.toEmail, "complaint", null);
      return "updated";
    default: return "ignored";
  }
}
