"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInstructorTypesAction } from "@/app/(app)/office/staff/actions";
import type { TeachingData } from "@/lib/domain/teaching";
import { ConfirmDialog } from "./ConfirmDialog";
import { InstructorTypesEditor, approvalsToSave, type TypesValue } from "./InstructorTypesEditor";

/**
 * On a staff member's page: tick the instructor types they hold and the
 * courses they're approved for; the courses they can teach follow from the
 * types. Unticking a type that has an uploaded copy, a certificate number or
 * an expiry date asks first, because that record goes too.
 */
export function StaffInstructorTypes({ instructorId, name, data, heldTypeIds, approvedIds, recorded }: {
  instructorId: string;
  name: string;
  data: TeachingData;
  heldTypeIds: string[];
  approvedIds: string[];
  /** Type id → what is on file for it ("an uploaded copy, expiry 3 Mar 2027"), for the types that have something. */
  recorded: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState<TypesValue>({ typeIds: new Set(heldTypeIds), approvedIds: new Set(approvedIds) });
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const approvals = approvalsToSave(data, value);
  const initialApprovals = approvalsToSave(data, { typeIds: new Set(heldTypeIds), approvedIds: new Set(approvedIds) });
  const sameSet = (a: Iterable<string>, b: readonly string[]) => { const x = new Set(a); return x.size === new Set(b).size && b.every((id) => x.has(id)); };
  const changed = !sameSet(value.typeIds, heldTypeIds) || !sameSet(approvals, initialApprovals);
  const typeName = (id: string) => data.types.find((t) => t.id === id)?.name ?? "That type";
  const losing = heldTypeIds.filter((id) => !value.typeIds.has(id) && recorded[id]);

  const save = () => {
    setAsking(false);
    setMsg(null);
    start(async () => {
      try {
        const r = await setInstructorTypesAction({ instructorId, typeIds: [...value.typeIds], approvedCourseIds: approvals });
        setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Saved" : r.error ?? "That didn't save" });
        if (r.ok) router.refresh();
      } catch { setMsg({ ok: false, text: "That didn't save. Reload the page and try again." }); }
    });
  };

  return (
    <div>
      <InstructorTypesEditor data={data} value={value} onChange={setValue} personName={name} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || !changed} onClick={() => (losing.length ? setAsking(true) : save())} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : "Save instructor types"}</button>
        {changed ? <button type="button" onClick={() => setValue({ typeIds: new Set(heldTypeIds), approvedIds: new Set(approvedIds) })} className="text-sm text-slate-500 hover:text-navy">Undo changes</button> : null}
        {msg ? <span role="status" className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
      <p className="mt-2 text-xs text-slate-400">A ticked type gets a licence record on {name}&rsquo;s file: upload a copy, the certificate number and any expiry under Licences &amp; documents.</p>
      <ConfirmDialog open={asking} title={`Remove ${losing.length === 1 ? typeName(losing[0]!) : `${losing.length} instructor types`} from ${name}?`} confirmLabel="Remove and save" busy={pending} onCancel={() => setAsking(false)} onConfirm={save}
        consequences={[
          ...losing.map((id) => `${typeName(id)}: ${recorded[id]} will be deleted.`),
          "The courses they can teach are worked out again from the types left.",
          "Anyone rostered in a place that needed that type shows as a problem on the board.",
        ]} />
    </div>
  );
}
