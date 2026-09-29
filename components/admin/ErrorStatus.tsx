"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setErrorStatusAction } from "@/app/admin/actions";

const OPTS = ["new", "seen", "resolved"];

export function ErrorStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => start(async () => { await setErrorStatusAction(id, e.target.value); router.refresh(); })}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-teal"
    >
      {OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
