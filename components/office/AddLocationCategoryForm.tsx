"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLocationCategoryAction } from "@/app/(app)/office/locations/actions";

/** Add a location category. A failed save shows a message instead of sticking on "Adding…". */
export function AddLocationCategoryForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      try {
        const r = await createLocationCategoryAction({ ok: false }, data);
        setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Added" : r.error ?? "That didn't save" });
        if (r.ok) { ref.current?.reset(); router.refresh(); }
      } catch {
        setMsg({ ok: false, text: "That didn't save. Reload the page and try again." });
      }
    });
  };
  return (
    <form ref={ref} onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="New category (e.g. Slipways, Pontoons)" required className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal" />
      <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">
        {pending ? "Adding…" : "+ Add category"}
      </button>
      {msg ? <span className={`w-full text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</span> : null}
    </form>
  );
}
