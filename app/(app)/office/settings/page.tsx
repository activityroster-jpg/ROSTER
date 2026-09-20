import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { GeneralSettingsForm } from "@/components/office/GeneralSettingsForm";
import { ConfigManager, type ConfigItem } from "@/components/office/ConfigManager";

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

  const toItems = <T extends { id: string; active: boolean }>(rows: T[], label: (r: T) => string, meta?: (r: T) => string): ConfigItem[] =>
    rows.map((r) => ({ id: r.id, label: label(r), active: r.active, meta: meta?.(r) }));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Settings</h1>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">General</h2>
        <GeneralSettingsForm
          schedulingMode={s?.schedulingMode ?? "session"}
          alertLeadDays={s?.alertLeadDays ?? 30}
          currency={s?.currency ?? "GBP"}
          timezone={s?.timezone ?? "Europe/London"}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigManager
          title="Session slots"
          kind="slot"
          items={toItems(slots, (x) => `${x.code} · ${x.label}`, (x) => `${x.startTime}–${x.endTime}`)}
          extraFields={[
            { name: "code", label: "Code (AM/PM/EV)", type: "text", placeholder: "AM" },
            { name: "startTime", label: "Start", type: "time" },
            { name: "endTime", label: "End", type: "time" },
          ]}
        />
        <ConfigManager
          title="Roles"
          kind="role"
          items={toItems(roles, (r) => r.name, (r) => [r.countsTowardRatio ? "ratio" : "", r.isSafetyCover ? "safety" : "", r.isFirstAider ? "first-aid" : ""].filter(Boolean).join(", "))}
          extraFields={[
            { name: "countsTowardRatio", label: "Ratio", type: "checkbox" },
            { name: "isSafetyCover", label: "Safety", type: "checkbox" },
            { name: "isFirstAider", label: "First aid", type: "checkbox" },
          ]}
        />
        <ConfigManager
          title="Grades"
          kind="grade"
          items={toItems(grades, (g) => g.name, (g) => g.discipline ?? "")}
          extraFields={[
            { name: "discipline", label: "Discipline", type: "text" },
            { name: "rank", label: "Rank", type: "number" },
            { name: "expiryTracked", label: "Expiry", type: "checkbox" },
          ]}
        />
        <ConfigManager
          title="Compliance checks"
          kind="compliance"
          items={toItems(compliance, (c) => c.name, (c) => (c.mandatory ? "mandatory" : ""))}
          extraFields={[
            { name: "mandatory", label: "Mandatory", type: "checkbox" },
            { name: "expiryTracked", label: "Expiry", type: "checkbox" },
          ]}
        />
        <ConfigManager
          title="Equipment types"
          kind="equipmentType"
          items={toItems(equipmentTypes, (e) => e.name, (e) => (e.inventoryTracked ? "tracked" : "bulk"))}
          extraFields={[{ name: "inventoryTracked", label: "Tracked", type: "checkbox" }]}
        />
        <ConfigManager
          title="Location types"
          kind="locationType"
          items={toItems(locationTypes, (l) => l.name)}
        />
      </div>

      <Card className="mt-8">
        <h2 className="mb-3 font-semibold text-navy">Data &amp; billing</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/api/office/export" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Export all data (JSON)
          </a>
          <a href="/api/billing/portal" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Manage billing
          </a>
          <a href="/security" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy hover:bg-slate-50">
            Security &amp; 2FA
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Your data is stored in the EU. Config is deactivate-never-delete: retiring an item keeps historical records
          intact.
        </p>
      </Card>
    </div>
  );
}
