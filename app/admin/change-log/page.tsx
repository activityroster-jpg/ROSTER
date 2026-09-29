import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const when = (d: Date) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminChangeLogPage() {
  await requirePlatformAdmin();
  const platform = new PlatformRepository(await getDb());
  const rows = await platform.recentAudit(300);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Change log</h1>
      <p className="mb-6 text-sm text-slate-500">Recent activity across every centre — configuration, roster and billing changes (from each centre&apos;s audit trail).</p>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Centre</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No activity yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{when(r.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-navy">{r.org}</td>
                <td className="px-4 py-3 text-slate-600">{r.action}</td>
                <td className="px-4 py-3 text-slate-600">{r.entity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
