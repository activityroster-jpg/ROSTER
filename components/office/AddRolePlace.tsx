"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRolePlaceAction } from "@/app/(app)/office/courses/actions";
import { PlaceSelect, type PlaceOption } from "./PlaceSelect";

/**
 * The clear box under a course's staffing rows: pick a place, add one more of
 * it. The list shows the instructor types that teach this course, with
 * "Other…" for the rest.
 */
export function AddRolePlace({ courseId, roles, relevant, onChanged }: { courseId: string; roles: PlaceOption[]; relevant?: readonly string[] | null; onChanged?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [roleId, setRoleId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const add = () => start(async () => {
    const r = await addRolePlaceAction(courseId, roleId);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Added" : r.error ?? "Couldn't add" });
    if (r.ok) { setRoleId(""); router.refresh(); onChanged?.(); }
  });
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5">
      <span className="text-xs font-semibold text-slate-500">Add another place</span>
      <PlaceSelect value={roleId} onChange={setRoleId} places={roles} relevant={relevant} ariaLabel="Place to add" placeholder="Choose an instructor type…" className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal" />
      <button type="button" disabled={pending || !roleId} onClick={add} className="rounded-lg border border-teal px-3 py-1 text-sm font-semibold text-teal hover:bg-teal/5 disabled:opacity-50">{pending ? "Adding…" : "+ Add place"}</button>
      {msg ? <span className={`text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
    </div>
  );
}
