import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { AddEquipmentForm } from "@/components/office/AddEquipmentForm";
import { EquipmentTypeManager, type EquipmentTypeRow } from "@/components/office/EquipmentTypeManager";
import { FeatureNotice } from "@/components/office/FeatureNotice";
import { hasFeature } from "@/lib/features";
import { GuideLink } from "@/components/GuideLink";
import { EquipmentRow } from "@/components/office/EquipmentRow";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const [equipment, types, settings, courseEquipment] = await Promise.all([
    repos.tenant.equipment.list(ctx),
    repos.tenant.equipmentType.list(ctx),
    repos.tenant.orgSettings.list(ctx),
    repos.tenant.courseEquipment.list(ctx),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const referenced = new Set(courseEquipment.map((ce) => ce.equipmentId).filter((x): x is string => Boolean(x)));
  const rowOf = (e: (typeof equipment)[number]) => ({ id: e.id, name: e.name, type: typeName.get(e.equipmentTypeId) ?? "—", identifier: e.identifier ?? null, status: e.status, referenced: referenced.has(e.id) });
  const current = equipment.filter((e) => e.status !== "retired").sort((a, b) => a.name.localeCompare(b.name));
  const retiredUnits = equipment.filter((e) => e.status === "retired").sort((a, b) => a.name.localeCompare(b.name));
  const activeTypes = types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
  const enabled = hasFeature(settings[0]?.enabledFeatures, "equipment");
  const typeRows: EquipmentTypeRow[] = types
    .map((t) => ({ id: t.id, name: t.name, quantity: t.quantity ?? null, inventoryTracked: Boolean(t.inventoryTracked), active: Boolean(t.active) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Equipment</h1>
        <GuideLink topic="equipment" />
      </div>
      <FeatureNotice feature="equipment" enabled={enabled} />

      <h2 className="mb-1 font-semibold text-navy">Equipment types</h2>
      <p className="mb-3 text-xs text-slate-500">Your kinds of kit and how many of each you have. Tracked types are booked unit by unit and clash-checked; bulk types are shared.</p>
      <div className="mb-8"><EquipmentTypeManager rows={typeRows} /></div>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Add equipment</h2>
        <AddEquipmentForm types={activeTypes} />
      </Card>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Identifier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {current.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No equipment yet.
                </td>
              </tr>
            ) : (
              current.map((e) => <EquipmentRow key={e.id} row={rowOf(e)} />)
            )}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-slate-400">A unit in maintenance stays on its courses and shows on the problems list until it&apos;s back. Delete removes a unit nothing has used; anything a course used is retired instead.</p>
      {retiredUnits.length > 0 ? (
        <details className="mt-4 rounded-card border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">Retired equipment <span className="font-normal text-slate-400">({retiredUnits.length}) · still shown on the courses that used it</span></summary>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {retiredUnits.map((e) => <EquipmentRow key={e.id} row={rowOf(e)} />)}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
