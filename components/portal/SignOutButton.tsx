"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth/client";

export function SignOutButton({ to }: { to: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => { setBusy(true); try { await signOut(); } finally { window.location.href = to; } }}
      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
