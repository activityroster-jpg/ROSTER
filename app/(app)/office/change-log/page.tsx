import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChangeLogPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const entries = (await repos.tenant.auditLog.list(ctx)).sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
  );

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Change log</h1>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-400">No changes recorded yet.</li>
          ) : (
            entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-navy">{e.action}</span>{" "}
                  <span className="text-slate-500">on {e.entity}</span>
                </div>
                <time className="text-xs text-slate-400">
                  {e.createdAt ? new Date(e.createdAt).toLocaleString("en-GB") : ""}
                </time>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
