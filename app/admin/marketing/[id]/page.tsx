import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { LINKEDIN_META, parseProspectStatuses, stageOf } from "@/lib/marketing";
import { ProspectDetail, type InteractionRow, type ProspectDetailData } from "@/components/admin/ProspectDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "";
  try { name = (await new PlatformRepository(await getDb()).prospectById(id))?.name ?? ""; } catch { /* fall back to the generic title */ }
  return { title: name ? `${name} · Prospects` : "Prospect" };
}

/**
 * One prospect: everything on file, editable, with the log of letters, emails,
 * LinkedIn messages, calls and notes underneath. Opened in a new tab from the
 * list and the board.
 */
export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const platform = new PlatformRepository(await getDb());
  const p = await platform.prospectById(id);
  if (!p) notFound();
  const log = await platform.listInteractions(id);
  const ms = (d: Date | number | null | undefined) => (d == null ? null : d instanceof Date ? d.getTime() : Number(d));

  const statuses = parseProspectStatuses(p.statuses, p.status);
  const prospect: ProspectDetailData = {
    id: p.id,
    name: p.name,
    region: p.region ?? "",
    addressLine1: p.addressLine1 ?? "",
    addressLine2: p.addressLine2 ?? "",
    city: p.city ?? "",
    postcode: p.postcode ?? "",
    country: p.country ?? "United Kingdom",
    email: p.email ?? "",
    website: p.website ?? "",
    linkedinLabel: LINKEDIN_META[p.linkedinStatus ?? "not_contacted"].label,
    contactName: p.contactName ?? "",
    contactRole: p.contactRole ?? "",
    notes: p.notes ?? "",
    basisNote: p.basisNote ?? "",
    statuses,
    stage: stageOf(statuses),
    engagedAt: ms(p.engagedAt),
    source: p.source,
    soleTrader: Boolean(p.soleTrader),
    lawfulBasis: p.lawfulBasis,
    createdAt: ms(p.createdAt) ?? 0,
    updatedAt: ms(p.updatedAt) ?? 0,
  };
  const interactions: InteractionRow[] = log.map((i) => ({
    id: i.id, kind: i.kind, occurredOn: i.occurredOn, summary: i.summary, author: i.author, createdAt: ms(i.createdAt) ?? 0,
  }));

  return <ProspectDetail prospect={prospect} interactions={interactions} />;
}
