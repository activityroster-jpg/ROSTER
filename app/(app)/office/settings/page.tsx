import { requireTenant } from "@/lib/tenant/require";
import { Card, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const t = repos.tenant;
  const [settings, slots, roles, grades, compliance, equipmentTypes, locationTypes] = await Promise.all([
    t.orgSettings.list(ctx),
    t.sessionSlot.list(ctx),
    t.roleType.list(ctx),
    t.qualificationType.list(ctx),
    t.complianceType.list(ctx),
    t.equipmentType.list(ctx),
    t.locationType.list(ctx),
  ]);
  const s = settings[0];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Settings</h1>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">General</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-slate-500">Scheduling mode</dt>
            <dd className="font-medium capitalize text-navy">{s?.schedulingMode ?? "session"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Alert lead days</dt>
            <dd className="font-medium text-navy">{s?.alertLeadDays ?? 30}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Currency</dt>
            <dd className="font-medium text-navy">{s?.currency ?? "GBP"}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigList title="Session slots" rows={slots.map((x) => `${x.code} · ${x.label} (${x.startTime}–${x.endTime})`)} />
        <ConfigList title="Roles" rows={roles.map((r) => r.name)} inactive={roles.filter((r) => !r.active).length} />
        <ConfigList title="Grades" rows={grades.map((g) => `${g.name}`)} inactive={grades.filter((g) => !g.active).length} />
        <ConfigList
          title="Compliance checks"
          rows={compliance.map((c) => `${c.name}${c.mandatory ? " (mandatory)" : ""}`)}
        />
        <ConfigList title="Equipment types" rows={equipmentTypes.map((e) => e.name)} />
        <ConfigList title="Location types" rows={locationTypes.map((l) => l.name)} />
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Config is deactivate-never-delete: retiring an item keeps historical records intact.
      </p>

      <Card className="mt-8">
        <h2 className="mb-3 font-semibold text-navy">Data &amp; billing</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/office/export"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50"
          >
            Export all data (JSON)
          </a>
          <a
            href="/api/billing/portal"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50"
          >
            Manage billing
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Your data is stored in the EU. You can export it at any time; erasure is available on request and
          cascades across every record.
        </p>
      </Card>
    </div>
  );
}

function ConfigList({ title, rows, inactive = 0 }: { title: string; rows: string[]; inactive?: number }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-navy">{title}</h3>
        {inactive > 0 ? <StatusPill tone="neutral">{inactive} inactive</StatusPill> : null}
      </div>
      <ul className="space-y-1 text-sm text-slate-700">
        {rows.length === 0 ? (
          <li className="text-slate-400">None configured</li>
        ) : (
          rows.map((r, i) => <li key={i}>• {r}</li>)
        )}
      </ul>
    </Card>
  );
}
