import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { loadAllPacks } from "@/lib/rules/working-time/load";
import { RulePackEditor, type PackView } from "@/components/admin/RulePackEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rule packs" };

export default async function AdminRulesPage() {
  await requirePlatformAdmin();
  const packs: PackView[] = (await loadAllPacks(await getDb())).map((p) => ({
    key: p.pack.key,
    name: p.pack.name,
    version: p.pack.version,
    verified: p.pack.verified,
    source: p.source,
    updatedAt: p.updatedAt?.toISOString() ?? null,
    updatedBy: p.updatedBy,
    unverified: p.pack.bands.flatMap((b) => b.unverified.map((f) => `${b.label}: ${f}`)),
    citations: p.pack.citations,
    bands: p.pack.bands.map((b) => ({
      label: b.label,
      ages: `${b.minAge}–${b.maxAge}${b.until === "schoolLeaving" ? " (to school-leaving date)" : b.from === "schoolLeaving" ? " (from school-leaving date)" : ""}`,
      term: `${b.termTime.maxHoursPerDay ?? "–"}h/day · ${b.termTime.maxHoursPerWeek ?? "–"}h/week${b.termTime.maxHoursSchoolDay != null ? ` · school day ${b.termTime.maxHoursSchoolDay}h` : ""}${b.termTime.maxHoursSaturday != null ? ` · Sat ${b.termTime.maxHoursSaturday}h` : ""}${b.termTime.maxHoursSunday != null ? ` · Sun ${b.termTime.maxHoursSunday}h` : ""}`,
      holiday: `${b.holiday.maxHoursPerDay ?? "–"}h/day · ${b.holiday.maxHoursPerWeek ?? "–"}h/week${b.holiday.maxHoursSunday != null ? ` · Sun ${b.holiday.maxHoursSunday}h` : ""}`,
      hours: `${b.earliestStart ?? "–"} to ${b.latestFinish ?? "–"}`,
      rest: `break ${b.breakMinutes ?? "–"} min after ${b.breakAfterHours ?? "–"}h · ${b.dailyRestHours ?? "–"}h daily rest · ${b.weeklyRestDays != null ? `${b.weeklyRestDays} days off in 7` : b.weeklyRestHours != null ? `${b.weeklyRestHours}h weekly rest` : "–"}`,
    })),
    json: JSON.stringify(p.pack, null, 2),
  }));
  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-bold text-navy">Rule packs · young workers&rsquo; hours</h1>
      <p className="mb-5 max-w-3xl text-sm text-slate-500">
        The legal figures the rostering checks use, one pack per jurisdiction. They are data, not code: edit a figure here and every centre in that
        jurisdiction picks it up on its next rota change. A pack is only <strong>verified</strong> once every figure has been checked against the official
        source and each band&rsquo;s <code>unverified</code> list is empty; until then centres see &ldquo;figure not yet verified&rdquo; on the warnings it produces.
        To verify: GOV.UK child employment pages and the local authority bylaws (England, Wales, Scotland), the Education Authority (Northern Ireland), and the
        WRC / Protection of Young Persons (Employment) Act 1996 (Ireland). Record the source in <code>citations</code> and bump <code>version</code>.
      </p>
      <RulePackEditor packs={packs} />
    </div>
  );
}
