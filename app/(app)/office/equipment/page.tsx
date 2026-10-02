import { requireTenant } from "@/lib/tenant/require";
import { Card, StatusPill } from "@/components/ui";
import { AddEquipmentForm } from "@/components/office/AddEquipmentForm";
import { EquipmentTypeManager, type EquipmentTypeRow } from "@/components/office/EquipmentTypeManager";
import { FeatureNotice } from "@/components/office/FeatureNotice";
import { hasFeature } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const [equipment, types, settings] = await Promise.all([
    repos.tenant.equipment.list(ctx),
    repos.tenant.equipmentType.list(ctx),
    repos.tenant.orgSettings.list(ctx),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const activeTypes = types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
  const enabled = hasFeature(settings[0]?.enabledFeatures, "equipment");
  const typeRows: EquipmentTypeRow[] = types
    .map((t) => ({ id: t.id, name: t.name, quantity: t.quantity ?? null, inventoryTracked: Boolean(t.inventoryTracked), active: Boolean(t.active) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Equipment</h1>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipment.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No equipment yet.
                </td>
              </tr>
            ) : (
              equipment.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-navy">{e.name}</td>
                  <td className="px-4 py-3 text-slate-600">{typeName.get(e.equipmentTypeId) ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.identifier ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={e.status === "available" ? "covered" : e.status === "retired" ? "neutral" : "attention"}>
                      {e.status}
                    </StatusPill>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
