"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAddStaffAction } from "@/app/(app)/office/staff/import/actions";
import { parsePastedStaff } from "@/lib/domain/paste-staff";

/**
 * The quick way in (audit follow-up): a name and an email, invite ticked, or a
 * pasted list for the start of the season. People then fill in their own
 * details, date of birth and certificates from the invite.
 */
export function QuickAddStaff() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"one" | "list">("one");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [list, setList] = useState("");
  const [invite, setInvite] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const preview = mode === "list" ? parsePastedStaff(list) : null;
  const field = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal";

  const submit = () => start(async () => {
    const people = mode === "one" ? [{ name: name.trim(), email: email.trim() || null }] : preview!.people;
    if (people.length === 0 || !people[0]!.name) { setMsg({ ok: false, text: mode === "one" ? "Enter their name" : "Paste at least one name" }); return; }
    const r = await quickAddStaffAction({ people, sendInvites: invite });
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? `Added ${r.created}${r.invited ? `, invited ${r.invited}` : ""}` : r.error ?? "Failed" });
    if (r.ok) { setName(""); setEmail(""); setList(""); router.refresh(); }
  });

  return (
    <div>
      <div className="mb-2 inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
        <button type="button" onClick={() => setMode("one")} className={`rounded-md px-2.5 py-1 font-medium ${mode === "one" ? "bg-navy text-white" : "text-slate-500"}`}>Quick add</button>
        <button type="button" onClick={() => setMode("list")} className={`rounded-md px-2.5 py-1 font-medium ${mode === "list" ? "bg-navy text-white" : "text-slate-500"}`}>Paste a list</button>
      </div>
      {mode === "one" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${field} mt-0.5 block w-48`} /></label>
          <label className="text-xs text-slate-500">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={`${field} mt-0.5 block w-60`} /></label>
        </div>
      ) : (
        <div>
          <textarea value={list} onChange={(e) => setList(e.target.value)} rows={5} placeholder={"One person per line, for example:\nSam Jones, sam@example.org\nKim Lee <kim@example.org>"} className={`${field} w-full font-mono text-xs`} />
          {preview && preview.people.length ? <p className="mt-1 text-xs text-slate-500">{preview.people.length} {preview.people.length === 1 ? "person" : "people"} found{preview.people.filter((p) => !p.email).length ? `, ${preview.people.filter((p) => !p.email).length} without an email (added, not invited)` : ""}{preview.skipped ? `; ${preview.skipped} line${preview.skipped === 1 ? "" : "s"} skipped` : ""}.</p> : null}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Send the invite</label>
        <button type="button" disabled={pending} onClick={submit} className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Adding…" : mode === "one" ? "Add" : "Add everyone"}</button>
        {msg ? <span className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">They fill in their own phone, date of birth and certificates from the invite. Add courses and checks later from their profile.</p>
    </div>
  );
}
