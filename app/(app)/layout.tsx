import type { ReactNode } from "react";

/**
 * Render every page in this group per request. Sign-in, two-factor and
 * reset-password are client pages that would otherwise be prerendered at build
 * time, and a prerendered page cannot carry the per-request CSP nonce
 * (lib/security/csp), so every script on it was reported as a violation. The
 * office and portal pages were dynamic already.
 */
export const dynamic = "force-dynamic";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
