"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upgradeInstructorTypesAction } from "@/app/admin/actions";
import type { UpgradeReport } from "@/lib/services/instructor-types-upgrade";

interface Centre { id: string; name: string; slug: string }

/** The report in plain words, leaving out what didn't change. */
function describe(r: UpgradeReport): string[] {
  if (r.skipped) return [r.skipped];
  const n = (count: number, one: string, many = `${one}s`) => (count ? `${count} ${count === 1 ? one : many}` : "");
  return [
    [n(r.typesAdded, "instructor type added", "instructor types added"), n(r.typesUpdated, "instructor type brought up to date", "instructor types brought up to date")].filter(Boolean).join(", "),
    [n(r.placesAdded, "place on courses added", "places on courses added"), n(r.placesRenamed, "place renamed", "places renamed")].filter(Boolean).join(", "),
    [n(r.coursesAdded, "course type added"), n(r.coursesAddedOff, "course type added switched off", "course types added switched off"), n(r.ratiosUpdated, "ratio moved to the new default", "ratios moved to the new default"), n(r.upcomingRatiosUpdated, "upcoming course's ratio updated", "upcoming courses' ratios updated"), n(r.safetyBoatOff, "course type no longer asks for a safety boat driver", "course types no longer ask for a safety boat driver")].filter(Boolean).join(", "),
    n(r.mapRows, "who-can-teach link", "who-can-teach links"),
    [n(r.linesConverted, "staff line converted", "staff lines converted"), n(r.safetyLinesRemoved, "safety boat line removed", "safety boat lines removed"), n(r.assignmentsConverted, "person moved to an instructor-type place", "people moved to instructor-type places"), n(r.assignmentsMerged, "duplicate assignment merged", "duplicate assignments merged"), n(r.dayChangesConverted, "one-day change converted", "one-day changes converted"), n(r.openShiftsConverted, "open shift converted", "open shifts converted")].filter(Boolean).join(", "),
    [n(r.ratesCopied, "pay rate copied to an instructor-type place", "pay rates copied to instructor-type places"), n(r.rolesRetired, "old place retired", "old places retired")].filter(Boolean).join(", "),
    r.notConverted ? `${r.notConverted} upcoming item${r.notConverted === 1 ? " is" : "s are"} on a course with no instructor types linked: the centre links them in Course setup, then run this again.` : "",
    r.complete ? "Done: the centre is on instructor types." : "",
  ].filter(Boolean);
}

/**
 * Dev Center: move existing RYA centres onto instructor types. Preview shows
 * what would change without changing anything; Upgrade does it. Safe to run
 * again (it carries on where it left off).
 */
export function InstructorTypesUpgrade({ centres }: { centres: Centre[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [results, setResults] = useState<Record<string, { dryRun: boolean; lines: string[]; ok: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const runOne = async (c: Centre, dryRun: boolean) => {
    setBusy(c.id);
    const r = await upgradeInstructorTypesAction(c.id, dryRun);
    setResults((m) => ({ ...m, [c.id]: { dryRun, ok: r.ok, lines: r.ok && r.report ? describe(r.report) : [r.error ?? "Failed"] } }));
    setBusy(null);
  };
  const runAll = (dryRun: boolean) => start(async () => {
    if (!dryRun && !(await askConfirm(`Upgrade all ${centres.length} centres now? Each one's instructor types, places, course links and upcoming courses are converted. Run it on staging first.`))) return;
    for (const c of centres) await runOne(c, dryRun);
    if (!dryRun) router.refresh();
  });

  if (centres.length === 0) return <p className="text-sm text-starboard">Every RYA centre is on instructor types.</p>;
  return (
    <div className="text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || busy !== null} onClick={() => runAll(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Preview all ({centres.length})</button>
        <button type="button" disabled={pending || busy !== null} onClick={() => runAll(false)} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Upgrade all</button>
        {pending ? <span className="text-xs text-slate-500">Working through the list…</span> : null}
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {centres.map((c) => {
          const res = results[c.id];
          return (
            <li key={c.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-navy">{c.name}</span>
                <span className="text-xs text-slate-400">{c.slug}</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" disabled={busy !== null || pending} onClick={() => start(() => runOne(c, true))} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-navy hover:bg-slate-50 disabled:opacity-50">{busy === c.id ? "…" : "Preview"}</button>
                  <button type="button" disabled={busy !== null || pending} onClick={() => start(async () => { if (await askConfirm(`Upgrade ${c.name} now?`)) { await runOne(c, false); router.refresh(); } })} className="rounded bg-teal px-2 py-0.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Upgrade</button>
                </span>
              </div>
              {res ? (
                <div className={`mt-1 text-xs ${res.ok ? "text-slate-600" : "text-port"}`}>
                  <p className="font-semibold">{res.dryRun ? "Preview (nothing changed):" : "Upgraded:"}</p>
                  <ul className="list-disc pl-5">{res.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
