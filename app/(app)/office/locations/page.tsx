import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { AddLocationForm } from "@/components/office/AddLocationForm";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const [locations, types] = await Promise.all([
    repos.tenant.location.list(ctx),
    repos.tenant.locationType.list(ctx),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const activeTypes = types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));

  const grouped = new Map<string, typeof locations>();
  for (const l of locations) {
    const key = l.locationTypeId ? typeName.get(l.locationTypeId) ?? "Other" : "Uncategorised";
    grouped.set(key, [...(grouped.get(key) ?? []), l]);
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">Locations</h1>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Add location</h2>
        <AddLocationForm types={activeTypes} />
      </Card>

      {locations.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No locations yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...grouped.entries()].map(([category, items]) => (
            <Card key={category}>
              <h3 className="mb-2 font-semibold text-navy">{category}</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {items.map((l) => (
                  <li key={l.id}>• {l.name}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
