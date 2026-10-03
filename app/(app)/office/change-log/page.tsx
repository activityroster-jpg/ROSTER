import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { GuideLink } from "@/components/GuideLink";
import { describeAudit } from "@/lib/services/changelog";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export default async function ChangeLogPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const entries = (await repos.tenant.auditLog.list(ctx))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, 400);

  // Who did it: the admin login (the centre's name), an instructor's name, or the system.
  const actorIds = [...new Set(entries.map((e) => e.actorUserId).filter((x): x is string => Boolean(x)))];
  const instructors = await repos.tenant.instructor.list(ctx);
  const byUser = new Map(instructors.filter((i) => i.userId).map((i) => [i.userId!, i.name]));
  const names = new Map<string, string>();
  for (const id of actorIds) {
    const inst = byUser.get(id);
    if (inst) { names.set(id, inst); continue; }
    const u = await repos.control.userById(id);
    names.set(id, u?.name ?? u?.email ?? "Someone");
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Change log</h1>
          <p className="text-sm text-slate-500">Everything that changed in your centre, newest first — who, what and when.</p>
        </div>
        <GuideLink topic="data" />
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-400">No changes recorded yet.</li>
          ) : (
            entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <div>
                  <span className="font-medium text-navy">{e.actorUserId ? names.get(e.actorUserId) ?? "Someone" : "ActivityRoster"}</span>{" "}
                  <span className="text-slate-600">{describeAudit(e.action, e.entity, e.after)}</span>
                </div>
                <time className="text-xs text-slate-400">{e.createdAt ? fmt(new Date(e.createdAt)) : ""}</time>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
