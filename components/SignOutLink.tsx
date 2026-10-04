"use client";

import { authClient } from "@/lib/auth/client";

/** Text link that signs the account out and returns to the sign-in chooser. */
export function SignOutLink({ children = "Sign out", to = "/login" }: { children?: React.ReactNode; to?: string }) {
  return (
    <button type="button" onClick={async () => { try { await authClient.signOut(); } finally { window.location.href = to; } }} className="underline hover:text-navy">
      {children}
    </button>
  );
}
