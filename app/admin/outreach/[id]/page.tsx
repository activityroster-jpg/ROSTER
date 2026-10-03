import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";
import { CampaignControls } from "@/components/admin/OutreachControls";
import { OutreachLeads, type LeadRow } from "@/components/admin/OutreachLeads";
import { OutreachCampaignForm, type CampaignFormValues } from "@/components/admin/OutreachCampaignForm";
import { parseResearch, parseSteps, windowOpen } from "@/lib/outreach/engine";
import { audienceSchema } from "@/lib/outreach/schema";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const { tab } = await searchParams;
  const p = new PlatformRepository(await getDb());
  const c = await p.getOutreachCampaign(id);
  if (!c) notFound();
  const [leads, messages, prospects, counts] = await Promise.all([p.listOutreachLeads(c.id, { limit: 5000 }), p.listCampaignMessages(c.id), p.listProspects(5000, 0), p.outreachLeadCountsByStatus(c.id)]);
  const regions = [...new Set(prospects.map((x) => (x.region ?? "").trim()).filter(Boolean))].sort();
  const steps = parseSteps(c);
  const byLead = new Map<string, typeof messages>();
  for (const m of messages) byLead.set(m.leadId, [...(byLead.get(m.leadId) ?? []), m]);
  const rows: LeadRow[] = leads.map((l) => {
    const r = parseResearch(l);
    return {
      id: l.id, centreName: l.centreName, website: l.website, region: l.region, email: l.email, emailVerified: !!l.emailVerified,
      contactName: l.contactName, contactRole: l.contactRole, status: l.status, stepIndex: l.stepIndex, nextSendAt: l.nextSendAt?.toISOString() ?? null,
      error: l.error, hooks: r?.hooks ?? [], summary: r?.summary ?? null, chosenReason: r?.chosenReason ?? null,
      messages: (byLead.get(l.id) ?? []).sort((a, b) => a.step - b.step).map((m) => ({ step: m.step, subject: m.subject, status: m.status, sentAt: m.sentAt.toISOString(), bodyText: m.bodyText })),
    };
  });
  const audience = audienceSchema.safeParse(JSON.parse(c.audience));
  const initial: CampaignFormValues = {
    name: c.name, pitch: c.pitch, targetRoles: c.targetRoles, tone: c.tone ?? "", fromName: c.fromName, fromEmail: c.fromEmail, replyTo: c.replyTo ?? "",
    dailyCap: c.dailyCap, sendWindowStart: c.sendWindowStart, sendWindowEnd: c.sendWindowEnd, weekdaysOnly: !!c.weekdaysOnly, aiPersonalise: !!c.aiPersonalise,
    steps, audience: audience.success ? audience.data : { regions: [], statuses: [], requireWebsite: true, excludeContactedDays: 90, limit: 200 },
  };
  const n = (...k: string[]) => k.reduce((a, x) => a + (counts.get(x) ?? 0), 0);
  const total = leads.length;
  const sent = messages.length;
  const opened = messages.filter((m) => m.status === "opened" || m.status === "clicked").length;
  const now = new Date();
  const hasDue = leads.some((l) => (l.status === "queued" || l.status === "in_sequence") && l.nextSendAt && l.nextSendAt <= now);
  const view = tab === "edit" ? "edit" : "leads";
  const tabLink = (v: string, label: string) => <Link href={`/admin/outreach/${c.id}${v === "edit" ? "?tab=edit" : ""}`} className={`rounded-md px-3 py-1 text-sm font-medium ${view === v ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>{label}</Link>;

  return (
    <div>
      <p className="mb-2 text-sm"><Link href="/admin/outreach" className="text-teal hover:underline">← Outreach</Link></p>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-navy">{c.name}</h1>
        <CampaignControls id={c.id} status={c.status} hasNew={n("new") > 0} hasDue={hasDue} />
      </div>
      <p className="mb-5 text-sm text-slate-500">
        {c.status === "draft" ? "Draft. Launch to pull in the audience and start researching." : null}
        {c.status === "running" ? `Running${windowOpen(c, now) ? ", inside sending hours" : ", outside sending hours (nothing goes out until they open)"}. Up to ${c.dailyCap} emails a day.` : null}
        {c.status === "paused" ? "Paused. Research and sending are on hold." : null}
        {c.status === "finished" ? "Finished." : null}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card><p className="text-xs font-semibold text-navy">Centres</p><p className="mt-1 text-2xl font-semibold text-navy">{total}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">To research</p><p className="mt-1 text-2xl font-semibold text-navy">{n("new")}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">In sequence</p><p className="mt-1 text-2xl font-semibold text-navy">{n("queued", "in_sequence", "sending")}</p></Card>
        <Card><p className="text-xs font-semibold text-navy">Sent / opened</p><p className="mt-1 text-2xl font-semibold text-navy">{sent} <span className="text-base text-slate-400">/ {opened}</span></p></Card>
        <Card><p className="text-xs font-semibold text-navy">Replied / booked</p><p className="mt-1 text-2xl font-semibold text-starboard">{n("replied")} <span className="text-base text-slate-400">/ {n("booked")}</span></p></Card>
        <Card><p className="text-xs font-semibold text-navy">Need you</p><p className={`mt-1 text-2xl font-semibold ${n("no_email", "failed") ? "text-amber-600" : "text-navy"}`}>{n("no_email", "failed")}</p><p className="text-xs text-slate-400">no address or failed</p></Card>
      </div>

      <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5 w-fit">{tabLink("leads", "Centres")}{tabLink("edit", "Edit campaign")}</div>
      {view === "edit" ? <OutreachCampaignForm id={c.id} initial={initial} regions={regions} /> : <OutreachLeads leads={rows} steps={steps.length} />}
    </div>
  );
}
