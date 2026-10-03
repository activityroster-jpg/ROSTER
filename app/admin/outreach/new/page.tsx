import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { EMPTY_CAMPAIGN, OutreachCampaignForm } from "@/components/admin/OutreachCampaignForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  await requirePlatformAdmin();
  const p = new PlatformRepository(await getDb());
  const prospects = await p.listProspects(5000, 0);
  const regions = [...new Set(prospects.map((x) => (x.region ?? "").trim()).filter(Boolean))].sort();
  return (
    <div>
      <p className="mb-2 text-sm"><Link href="/admin/outreach" className="text-teal hover:underline">← Outreach</Link></p>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">New campaign</h1>
      <p className="mb-5 text-sm text-slate-500">Saved as a draft. Nothing is researched or sent until you press Launch on the next screen.</p>
      <OutreachCampaignForm initial={EMPTY_CAMPAIGN} regions={regions} />
    </div>
  );
}
