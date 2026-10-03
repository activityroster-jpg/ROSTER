"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { OUTREACH_LEAD_STATUSES, type OutreachLeadStatus, type SuppressionReason } from "@/lib/db/schema";
import { parseProspectStatuses } from "@/lib/marketing";
import { audienceSchema, campaignSchema, type CampaignInput } from "@/lib/outreach/schema";
import { parseResearch, parseSteps, researchBatch, runDueSends, unsubscribeUrl, usageSink } from "@/lib/outreach/engine";
import { composeEmail } from "@/lib/outreach/writer";
import { pickContact, researchProspect } from "@/lib/outreach/research";
import { emailLooksDeliverable } from "@/lib/outreach/validate";
import { COMPANY } from "@/lib/config";
import { firstIssue, idSchema } from "@/lib/validation/actions";
import { z } from "zod";
import type { AudienceFilter } from "@/lib/outreach/types";

export type OutreachResult = { ok: boolean; error?: string; message?: string; id?: string };

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(200);

function toRow(d: CampaignInput) {
  return {
    name: d.name, pitch: d.pitch, targetRoles: d.targetRoles, tone: d.tone?.trim() || null,
    fromName: d.fromName, fromEmail: d.fromEmail.toLowerCase(), replyTo: d.replyTo?.trim().toLowerCase() || null,
    dailyCap: d.dailyCap, sendWindowStart: d.sendWindowStart, sendWindowEnd: d.sendWindowEnd,
    weekdaysOnly: d.weekdaysOnly, aiPersonalise: d.aiPersonalise,
    steps: JSON.stringify(d.steps), audience: JSON.stringify(d.audience),
  };
}

/** Create a campaign as a draft; nothing is sent until it is launched. */
export async function createCampaignAction(input: unknown): Promise<OutreachResult> {
  const p = await platform();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const row = await p.insertOutreachCampaign({ ...toRow(parsed.data), status: "draft" });
  revalidatePath("/admin/outreach");
  return { ok: true, id: row.id, message: "Campaign saved as a draft" };
}

/** Edit a campaign. Audience changes only affect the next launch; the sequence applies to future steps. */
export async function updateCampaignAction(id: string, input: unknown): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const updated = await p.updateOutreachCampaign(pid.data, toRow(parsed.data));
  if (!updated) return { ok: false, error: "Not found" };
  revalidatePath("/admin/outreach");
  revalidatePath(`/admin/outreach/${pid.data}`);
  return { ok: true, id: pid.data, message: "Saved" };
}

/** How many prospects a given audience filter would pull in right now. */
export async function previewAudienceAction(input: unknown): Promise<{ ok: boolean; count?: number; withWebsite?: number; error?: string }> {
  const p = await platform();
  const parsed = audienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const picked = await selectAudience(p, parsed.data);
  return { ok: true, count: Math.min(picked.length, parsed.data.limit), withWebsite: picked.filter((x) => x.website).length };
}

async function selectAudience(p: PlatformRepository, a: AudienceFilter) {
  const all = await p.listProspects(5000, 0);
  const recent = a.excludeContactedDays > 0 ? await p.recentlyContactedProspectIds(a.excludeContactedDays) : new Set<string>();
  const regions = new Set(a.regions.map((r) => r.trim().toLowerCase()));
  const statuses = new Set(a.statuses);
  return all.filter((x) => {
    if (regions.size && !regions.has((x.region ?? "").trim().toLowerCase())) return false;
    if (statuses.size && !parseProspectStatuses(x.statuses, x.status).some((s) => statuses.has(s))) return false;
    if (a.requireWebsite && !x.website) return false;
    if (recent.has(x.id)) return false;
    const st = parseProspectStatuses(x.statuses, x.status);
    if (st.includes("purchased") || st.includes("rejected")) return false;
    return true;
  });
}

/**
 * Launch: turn the audience into leads (skipping anyone already in this
 * campaign or on the suppression list) and set the campaign running. Research
 * and sending then happen in batches from the tick route or the Run buttons.
 */
export async function launchCampaignAction(id: string): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const c = await p.getOutreachCampaign(pid.data);
  if (!c) return { ok: false, error: "Not found" };
  if (parseSteps(c).length === 0) return { ok: false, error: "Add at least one step first" };
  const audience = audienceSchema.safeParse(JSON.parse(c.audience));
  if (!audience.success) return { ok: false, error: "The audience filter is invalid; edit and save the campaign" };
  const existing = new Set((await p.listOutreachLeads(c.id, { limit: 10000 })).map((l) => l.prospectId).filter(Boolean));
  const picked = (await selectAudience(p, audience.data)).filter((x) => !existing.has(x.id)).slice(0, audience.data.limit);
  const rows = [];
  for (const x of picked) {
    const email = x.email?.trim().toLowerCase() || null;
    if (email && (await p.isSuppressed(email))) continue;
    // PECR: a sole trader or partnership is an individual; no marketing email without consent.
    if (x.soleTrader && x.lawfulBasis !== "consent") continue;
    rows.push({
      campaignId: c.id, prospectId: x.id, centreName: x.name, website: x.website, region: x.region, email,
      emailVerified: false, contactName: x.contactName, contactRole: x.contactRole, research: null,
      status: "new" as const, stepIndex: 0, nextSendAt: null, lastEventAt: null,
      unsubscribeToken: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8), error: null,
    });
  }
  const added = await p.insertOutreachLeads(rows);
  await p.updateOutreachCampaign(c.id, { status: "running", launchedAt: c.launchedAt ?? new Date() });
  revalidatePath("/admin/outreach");
  revalidatePath(`/admin/outreach/${c.id}`);
  return { ok: true, message: added ? `Running. ${added} centre${added === 1 ? "" : "s"} added; research starts on the next run.` : "Running. No new centres matched the audience." };
}

export async function setCampaignStatusAction(id: string, status: "paused" | "running" | "finished"): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(id);
  if (!pid.success || !["paused", "running", "finished"].includes(status)) return { ok: false, error: "Invalid request" };
  const c = await p.getOutreachCampaign(pid.data);
  if (!c) return { ok: false, error: "Not found" };
  if (c.status === "draft" && status === "running") return launchCampaignAction(pid.data);
  await p.updateOutreachCampaign(pid.data, { status });
  revalidatePath("/admin/outreach");
  revalidatePath(`/admin/outreach/${pid.data}`);
  return { ok: true, message: status === "paused" ? "Paused: nothing more will be sent until you resume." : status === "running" ? "Resumed." : "Marked finished." };
}

export async function deleteCampaignAction(id: string): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const c = await p.getOutreachCampaign(pid.data);
  if (!c) return { ok: false, error: "Not found" };
  if (c.status === "running") return { ok: false, error: "Pause the campaign before deleting it" };
  await p.deleteOutreachCampaign(pid.data);
  revalidatePath("/admin/outreach");
  return { ok: true, message: "Deleted" };
}

/** Research the next batch of new leads now (normally the hourly tick does this). */
export async function researchNowAction(id: string, limit = 10): Promise<OutreachResult> {
  await platform();
  const pid = idSchema.safeParse(id);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const r = await researchBatch(await getDb(), getEnv(), pid.data, Math.min(25, Math.max(1, limit)));
  revalidatePath(`/admin/outreach/${pid.data}`);
  return { ok: true, message: r.researched ? `Researched ${r.researched}: ${r.queued} ready to email, ${r.noEmail} with no usable address.` : "Nothing left to research." };
}

/** Send whatever is due now, within the campaign's hours and daily cap. */
export async function sendDueNowAction(id?: string, force = false): Promise<OutreachResult> {
  await platform();
  const pid = id ? idSchema.safeParse(id) : null;
  if (pid && !pid.success) return { ok: false, error: "Invalid id" };
  const r = await runDueSends(await getDb(), getEnv(), { campaignId: pid?.success ? pid.data : undefined, force, limit: 25 });
  revalidatePath("/admin/outreach");
  if (pid?.success) revalidatePath(`/admin/outreach/${pid.data}`);
  const bits = [`${r.sent} sent`, r.skipped ? `${r.skipped} skipped` : null, r.failed ? `${r.failed} failed` : null, ...r.notes].filter(Boolean);
  return { ok: true, message: bits.join(" · ") || "Nothing due." };
}

/** Re-research one lead on demand (e.g. after you fixed its website). */
export async function researchLeadAction(leadId: string): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(leadId);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const lead = await p.getOutreachLead(pid.data);
  if (!lead) return { ok: false, error: "Not found" };
  const c = await p.getOutreachCampaign(lead.campaignId);
  if (!c) return { ok: false, error: "Campaign missing" };
  const env = getEnv();
  const r = await researchProspect({ website: lead.website, knownEmail: lead.email, targetRoles: c.targetRoles, apiKey: env.ANTHROPIC_API_KEY, onUsage: usageSink(p, { campaignId: c.id, leadId: lead.id }) });
  const contact = pickContact(r, c.targetRoles);
  const email = r.chosenEmail ?? lead.email ?? null;
  const verified = email ? (await emailLooksDeliverable(email)).ok : false;
  const active = ["new", "no_email", "queued", "failed"].includes(lead.status);
  await p.updateOutreachLead(lead.id, {
    research: JSON.stringify(r), email, emailVerified: verified,
    contactName: contact.name ?? lead.contactName, contactRole: contact.role ?? lead.contactRole,
    ...(active ? { status: email && verified ? "queued" : "no_email", nextSendAt: email && verified ? new Date() : null, error: null } : {}),
  });
  revalidatePath(`/admin/outreach/${lead.campaignId}`);
  return { ok: true, message: email ? `Found ${email}${contact.name ? ` (${contact.name})` : ""}` : "No address found; add one by hand." };
}

/** Set or correct a lead's email/contact by hand and queue it. */
export async function setLeadContactAction(leadId: string, input: { email: string; contactName?: string; contactRole?: string }): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(leadId);
  const em = emailSchema.safeParse(input?.email);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  if (!em.success) return { ok: false, error: firstIssue(em.error) };
  const lead = await p.getOutreachLead(pid.data);
  if (!lead) return { ok: false, error: "Not found" };
  if (await p.isSuppressed(em.data)) return { ok: false, error: "That address is on the do-not-email list" };
  const check = await emailLooksDeliverable(em.data);
  const active = ["new", "no_email", "queued", "failed", "skipped", "bounced"].includes(lead.status);
  await p.updateOutreachLead(lead.id, {
    email: em.data, emailVerified: check.ok,
    contactName: String(input.contactName ?? "").trim().slice(0, 120) || lead.contactName,
    contactRole: String(input.contactRole ?? "").trim().slice(0, 80) || lead.contactRole,
    ...(active ? { status: "queued", nextSendAt: new Date(), error: check.ok ? null : `Domain check: ${check.reason}` } : {}),
  });
  revalidatePath(`/admin/outreach/${lead.campaignId}`);
  return { ok: true, message: check.ok ? "Saved and queued" : `Saved and queued, but the domain check said: ${check.reason}` };
}

const MANUAL: OutreachLeadStatus[] = ["skipped", "replied", "booked", "queued"];

/** Mark a lead by hand: skip it, or record that they replied / booked (which also stops the sequence). */
export async function setLeadStatusAction(leadId: string, status: string): Promise<OutreachResult> {
  const p = await platform();
  const pid = idSchema.safeParse(leadId);
  if (!pid.success || !(MANUAL as string[]).includes(status) || !(OUTREACH_LEAD_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid request" };
  const lead = await p.getOutreachLead(pid.data);
  if (!lead) return { ok: false, error: "Not found" };
  const s = status as OutreachLeadStatus;
  await p.updateOutreachLead(lead.id, { status: s, nextSendAt: s === "queued" && lead.email ? new Date() : null, lastEventAt: new Date() });
  if ((s === "replied" || s === "booked") && lead.email) await p.addSuppression(lead.email, "replied", `Replied to ${lead.centreName}`);
  if (lead.prospectId && (s === "replied" || s === "booked")) {
    const prospect = await p.prospectById(lead.prospectId);
    if (prospect) {
      const cur = parseProspectStatuses(prospect.statuses, prospect.status);
      const next = [...new Set([...cur.filter((x) => x !== "new"), "email_sent" as const])];
      await p.setProspectStatuses(prospect.id, next, next[next.length - 1] ?? "email_sent");
      await p.updateProspect(prospect.id, { notes: `${prospect.notes ? prospect.notes + "\n" : ""}${s === "booked" ? "Booked a demo" : "Replied"} via outreach ${new Date().toISOString().slice(0, 10)}` });
    }
  }
  revalidatePath(`/admin/outreach/${lead.campaignId}`);
  return { ok: true, message: s === "skipped" ? "Skipped" : s === "queued" ? "Back in the queue" : s === "booked" ? "Booked. They won't be emailed again." : "Marked replied. They won't be emailed again." };
}

/** Render the next email for a lead exactly as it would be sent (no send). */
export async function previewLeadEmailAction(leadId: string): Promise<{ ok: boolean; subject?: string; text?: string; usedAi?: boolean; error?: string }> {
  const p = await platform();
  const pid = idSchema.safeParse(leadId);
  if (!pid.success) return { ok: false, error: "Invalid id" };
  const lead = await p.getOutreachLead(pid.data);
  if (!lead) return { ok: false, error: "Not found" };
  const c = await p.getOutreachCampaign(lead.campaignId);
  if (!c) return { ok: false, error: "Campaign missing" };
  const steps = parseSteps(c);
  const step = steps[Math.min(lead.stepIndex, steps.length - 1)];
  if (!step) return { ok: false, error: "The campaign has no steps" };
  const env = getEnv();
  const previous = (await p.listOutreachMessages(lead.id)).map((m) => ({ subject: m.subject, text: m.bodyText }));
  const composed = await composeEmail({
    campaign: c, lead, step, stepIndex: Math.min(lead.stepIndex, steps.length - 1), research: parseResearch(lead), previous,
    unsubscribeUrl: unsubscribeUrl(env, lead.unsubscribeToken), company: env.COMPANY_LEGAL_NAME || COMPANY.legalName, address: env.COMPANY_ADDRESS || COMPANY.addressInline, apiKey: env.ANTHROPIC_API_KEY, onUsage: usageSink(p, { campaignId: c.id, leadId: lead.id }),
  });
  return { ok: true, subject: composed.subject, text: composed.text, usedAi: composed.usedAi };
}

export async function addSuppressionAction(email: string, note?: string): Promise<OutreachResult> {
  const p = await platform();
  const em = emailSchema.safeParse(email);
  if (!em.success) return { ok: false, error: firstIssue(em.error) };
  await p.addSuppression(em.data, "manual" satisfies SuppressionReason, String(note ?? "").trim().slice(0, 200) || null);
  revalidatePath("/admin/outreach");
  return { ok: true, message: `${em.data} will never be emailed` };
}

export async function removeSuppressionAction(email: string): Promise<OutreachResult> {
  const p = await platform();
  const em = emailSchema.safeParse(email);
  if (!em.success) return { ok: false, error: firstIssue(em.error) };
  await p.removeSuppression(em.data);
  revalidatePath("/admin/outreach");
  return { ok: true, message: "Removed from the do-not-email list" };
}
