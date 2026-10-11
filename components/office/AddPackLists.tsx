"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPackListsAction } from "@/app/(app)/office/course-setup/actions";

/** Course setup: pull in another activity's course list and instructor types (a centre that runs both). */
export function AddPackLists({ others }: { others: { id: string; label: string; blurb: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (others.length === 0) return null;
  const add = (id: string) => start(async () => {
    const r = await addPackListsAction(id);
    setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Added" : r.error ?? "Couldn't add" });
    if (r.ok) router.refresh();
  });
  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-navy">Run another kind of activity too?</h2>
      <p className="mt-1 text-sm text-slate-500">Add its standard course list and instructor types to yours. Nothing you already have changes, and you can retire anything you don&apos;t run.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {others.map((o) => (
          <button key={o.id} type="button" disabled={pending} onClick={() => add(o.id)} title={o.blurb} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy hover:border-teal hover:text-teal disabled:opacity-50">+ Add the {o.label} lists</button>
        ))}
      </div>
      {msg ? <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
    </section>
  );
}
