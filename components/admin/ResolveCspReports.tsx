"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolveCspReportsAction } from "@/app/admin/actions";

/** One click to clear every open browser CSP report from the error log. */
export function ResolveCspReports({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  if (done !== null) return <span className="text-xs text-starboard">Resolved {done} CSP report{done === 1 ? "" : "s"}.</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { const r = await resolveCspReportsAction(); setDone(r.count ?? 0); router.refresh(); })}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-navy hover:border-teal hover:text-teal disabled:opacity-50"
    >
      {pending ? "Resolving…" : `Resolve all ${count} CSP report${count === 1 ? "" : "s"}`}
    </button>
  );
}
