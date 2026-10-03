import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PrivacyQueue, type PrivacyRow } from "@/components/admin/PrivacyQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy requests" };

export default async function AdminPrivacyPage() {
  await requirePlatformAdmin();
  let rows: PrivacyRow[] = [];
  try {
    rows = (await new PlatformRepository(await getDb()).listPrivacyRequests()).map((r) => ({
      id: r.id, kind: r.kind, name: r.name, email: r.email, centre: r.centre, message: r.message, status: r.status,
      dueAt: r.dueAt.toISOString(), createdAt: r.createdAt.toISOString(), acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null, notes: r.notes,
    }));
  } catch { /* table arrives with the next migration */ }
  const open = rows.filter((r) => r.status !== "closed");
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Privacy requests <span className="text-base font-normal text-slate-400">{open.length} open</span></h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">Everything sent through the public data-request form, with its 30-day acknowledgement deadline. Requesters get an automatic receipt. Where a request concerns a centre&rsquo;s own records, the centre is the controller: pass it on, note who you passed it to, and keep the thread until it&rsquo;s closed.</p>
      <PrivacyQueue rows={rows} />
    </div>
  );
}
