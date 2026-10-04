import { requireTenant } from "@/lib/tenant/require";
import { Card } from "@/components/ui";
import { AddLocationForm } from "@/components/office/AddLocationForm";
import { AddLocationCategoryForm } from "@/components/office/AddLocationCategoryForm";
import { LocationItem } from "@/components/office/LocationItem";
import { LocationCategoryHeader, RetiredLocationCategory } from "@/components/office/LocationCategoryControls";
import { FeatureNotice } from "@/components/office/FeatureNotice";
import { hasFeature } from "@/lib/features";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const { ctx, repos } = await requireTenant({ permission: "roster.edit" });
  const [locations, types, settings] = await Promise.all([
    repos.tenant.location.list(ctx),
    repos.tenant.locationType.list(ctx),
    repos.tenant.orgSettings.list(ctx),
  ]);
  const activeTypes = types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }));
  const retiredTypes = types.filter((t) => !t.active).map((t) => ({ id: t.id, name: t.name }));
  const locationsEnabled = hasFeature(settings[0]?.enabledFeatures, "locations") || hasFeature(settings[0]?.enabledFeatures, "operatingAreas");

  // Bucket locations under each active category, preserving category order, plus
  // an "Uncategorised" bucket for anything without a (still-active) category.
  const byType = new Map<string, typeof locations>();
  for (const l of locations) {
    const key = l.locationTypeId && activeTypes.some((t) => t.id === l.locationTypeId) ? l.locationTypeId : "__none";
    byType.set(key, [...(byType.get(key) ?? []), l]);
  }
  const boxes = [
    ...activeTypes.map((t) => ({ id: t.id, name: t.name, items: byType.get(t.id) ?? [] })),
    ...(byType.get("__none")?.length ? [{ id: "__none", name: "Uncategorised", items: byType.get("__none")! }] : []),
  ];

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Locations</h1>
        <GuideLink topic="locations" />
      </div>
      <FeatureNotice feature="locations" enabled={locationsEnabled} />
      <p className="mb-6 text-sm text-slate-500">
        Everywhere activity happens — launch areas, classrooms, pontoons, operating areas. Group them into categories
        so they&apos;re easy to pick when you build a roster.
      </p>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-navy">Add a location</h2>
          <AddLocationForm types={activeTypes} />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold text-navy">Add a category</h2>
          <p className="mb-3 text-xs text-slate-500">Make your own groupings — they appear as boxes below and in the category picker.</p>
          <AddLocationCategoryForm />
        </Card>
      </div>

      {boxes.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No locations yet. Add your first above — categories keep them tidy.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map((box) => (
            <Card key={box.id}>
              {box.id === "__none" ? (
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-navy">{box.name}</h3>
                  <span className="text-xs text-slate-400">{box.items.length}</span>
                </div>
              ) : (
                <LocationCategoryHeader id={box.id} name={box.name} count={box.items.length} />
              )}
              {box.items.length === 0 ? (
                <p className="text-xs text-slate-400">No locations in this category yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {box.items.map((l) => (
                    <LocationItem key={l.id} id={l.id} name={l.name} active={Boolean(l.active)} />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {retiredTypes.length > 0 ? (
        <Card className="mt-6">
          <h2 className="mb-1 font-semibold text-navy">Retired categories</h2>
          <ul className="divide-y divide-slate-100">
            {retiredTypes.map((t) => <RetiredLocationCategory key={t.id} id={t.id} name={t.name} />)}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
