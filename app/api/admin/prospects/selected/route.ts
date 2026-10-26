import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PIPELINE_META, PROSPECT_STATUS_META, outreachSentOn, parseProspectStatuses, servicesOf, stageOf } from "@/lib/marketing";
import { followUpEmail } from "@/lib/marketing-email/follow-up";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = (d: Date | number | null | undefined) => (d == null ? "" : new Date(d).toISOString().slice(0, 10));
const body = z.object({ ids: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).min(1).max(2000) });

/**
 * The centres ticked on the pipeline board as a spreadsheet: every detail we
 * hold, including the email address, plus a follow-up email written for each
 * one (subject and body) that points at the Learning Centre. Opens in Excel,
 * Numbers or Google Sheets.
 */
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Tick at least one centre", { status: 400 });
  const wanted = new Set(parsed.data.ids);
  const platform = new PlatformRepository(await getDb());
  const [prospects, markers] = await Promise.all([platform.listProspects(10_000, 0), platform.outreachMarkers()]);
  const byProspect = new Map<string, typeof markers>();
  for (const m of markers) { const list = byProspect.get(m.prospectId); if (list) list.push(m); else byProspect.set(m.prospectId, [m]); }

  const head = [
    "Name", "Email", "Contact name", "Contact role", "Website", "Region", "Address 1", "Address 2", "Town", "Postcode", "Country",
    "Stage", "Ticks", "Booklet sent on", "Email sent on", "Kind of centre", "RYA services", "Sole trader (needs consent to email)", "Lawful basis",
    "Notes", "Email subject", "Email body",
  ];
  const lines = [head.map(cell).join(",")];
  for (const p of prospects.filter((x) => wanted.has(x.id)).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const statuses = parseProspectStatuses(p.statuses, p.status);
    const sent = outreachSentOn(byProspect.get(p.id) ?? []);
    const services = servicesOf(p.notes);
    const mail = followUpEmail({ id: p.id, name: p.name, city: p.city, region: p.region, contactName: p.contactName, services, activityType: p.activityType, bookletSentOn: sent.booklet ?? day(p.updatedAt) });
    lines.push([
      p.name, p.email, p.contactName, p.contactRole, p.website, p.region, p.addressLine1, p.addressLine2, p.city, p.postcode, p.country,
      PIPELINE_META[stageOf(statuses)].label, statuses.map((s) => PROSPECT_STATUS_META[s].label).join("; "),
      sent.booklet ?? "", sent.email ?? "", p.activityType, services.join("; "), p.soleTrader ? "Yes" : "", p.lawfulBasis,
      p.notes, mail.subject, mail.body,
    ].map(cell).join(","));
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="centres-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
