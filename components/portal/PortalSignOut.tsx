"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client";

/** Header icon button: sign out of the portal (and the app, on the apex). */
export function PortalSignOut({ to }: { to: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Sign out"
      title="Sign out"
      onClick={async () => { if (!await askConfirm("Sign out?")) return; setBusy(true); try { await signOut(); } finally { window.location.href = to; } }}
      className="rounded-full p-2 hover:bg-white/10 disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
