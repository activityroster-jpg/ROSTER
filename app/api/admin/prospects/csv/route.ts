import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { LINKEDIN_META, PIPELINE_META, PROSPECT_STATUS_META, outreachSentOn, parseLinkedinContacts, parseProspectStatuses, stageOf, topRanks } from "@/lib/marketing";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = (d: Date | number | null | undefined) => (d == null ? "" : new Date(d).toISOString().slice(0, 10));

/** The whole Prospects list as a spreadsheet: details, every tick, the board stage, when things went, LinkedIn and notes. */
export async function GET() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const [prospects, markers] = await Promise.all([platform.listProspects(10_000, 0), platform.outreachMarkers()]);
  const byProspect = new Map<string, typeof markers>();
  for (const m of markers) { const list = byProspect.get(m.prospectId); if (list) list.push(m); else byProspect.set(m.prospectId, [m]); }
  const ranks = topRanks(prospects);

  const head = [
    "Name", "Region", "Address 1", "Address 2", "Town", "Postcode", "Country", "Email", "Website", "Contact name", "Contact role",
    "Stage", "Ticks", "Engaged", "Booklet sent on", "Email sent on", "LinkedIn status", "LinkedIn page", "LinkedIn contacts",
    "Top 250 rank", "Kind of centre", "Lawful basis", "Sole trader", "Source", "Notes", "Added", "Last changed",
  ];
  const lines = [head.map(cell).join(",")];
  for (const p of prospects) {
    const statuses = parseProspectStatuses(p.statuses, p.status);
    const sent = outreachSentOn(byProspect.get(p.id) ?? []);
    lines.push([
      p.name, p.region, p.addressLine1, p.addressLine2, p.city, p.postcode, p.country, p.email, p.website, p.contactName, p.contactRole,
      PIPELINE_META[stageOf(statuses)].label,
      statuses.map((s) => PROSPECT_STATUS_META[s].label).join("; "),
      p.engagedAt ? "Yes" : "",
      sent.booklet ?? "", sent.email ?? "",
      LINKEDIN_META[p.linkedinStatus ?? "not_contacted"].label, p.linkedinUrl,
      parseLinkedinContacts(p.linkedinContacts).map((c) => [c.name, c.role, c.url].filter(Boolean).join(" ")).join("; "),
      ranks.get(p.id) ?? "", p.activityType, p.lawfulBasis, p.soleTrader ? "Yes" : "", p.source, p.notes,
      day(p.createdAt), day(p.updatedAt),
    ].map(cell).join(","));
  }
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activityroster-prospects-${day(Date.now())}.csv"`, "cache-control": "no-store" },
  });
}
