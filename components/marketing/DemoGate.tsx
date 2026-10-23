"use client";

import { useEffect, useState } from "react";
import { EmailStart } from "@/components/marketing/EmailStart";

/**
 * The demo page asks for an email before showing the screens. No password, no
 * confirmation: the address is recorded as a lead (Dev Center → Funnel) and the
 * tour opens at once. A cookie remembers it, so coming back is instant.
 */
export function DemoGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    try { setOpen(document.cookie.split(";").some((c) => c.trim().startsWith("ar_demo="))); } catch { setOpen(false); }
  }, []);

  if (open === null) return <div className="min-h-[24rem]" aria-busy="true" />;
  if (open) return <>{children}</>;
  return (
    <div className="mx-auto max-w-xl rounded-card border border-slate-200 bg-white p-6 shadow-lg">
      <p className="font-display text-xl font-semibold text-navy">See every screen</p>
      <p className="mb-4 mt-1 text-sm text-slate-600">Enter your email and the tour opens straight away: the office, the roster board, payroll and the instructor app, at a made-up centre in July.</p>
      <EmailStart source="demo" variant="demo" buttonLabel="Open the tour" onOpened={() => setOpen(true)} />
    </div>
  );
}
