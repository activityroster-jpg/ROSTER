"use client";

import { useState } from "react";
import { Turnstile } from "@/components/auth/Turnstile";

/**
 * The first step of signing up, small enough to sit anywhere: one email box.
 * Submitting records the address as a lead straight away (so a visitor who
 * stops here is still known) and sends them to /start with the email filled in,
 * where step two asks for the password and centre name.
 *
 *  - "hero": on the dark home-page hero.
 *  - "inline": on a white card (landing pages, the home-page footer).
 *  - "demo": gates the demo page; `onOpened` runs instead of going to /start.
 */
export function EmailStart({
  source,
  variant = "inline",
  plan,
  activityType,
  buttonLabel = "Start my free month",
  onOpened,
}: {
  source: string;
  variant?: "hero" | "inline" | "demo";
  /** Preselected plan from the pricing cards (carried to /start). */
  plan?: string;
  /** Preselected kind of centre (a sales page for one activity). */
  activityType?: string;
  buttonLabel?: string;
  onOpened?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setErr("Enter your email address to start."); return; }
    setBusy(true);
    try {
      // Record the lead now; a hiccup here must never stop the sign-up itself.
      let captured = false;
      try {
        const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: clean, source, turnstileToken: token }) });
        captured = res.ok;
      } catch { /* carry on */ }
      if (variant === "demo") {
        try { document.cookie = "ar_demo=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure"; } catch { /* ignore */ }
        onOpened?.();
        return;
      }
      const q = new URLSearchParams({ email: clean, src: source });
      if (captured) q.set("lead", "1");
      if (plan) q.set("plan", plan);
      if (activityType) q.set("type", activityType);
      window.location.href = `/start?${q.toString()}`;
    } finally { setBusy(false); }
  };

  const dark = variant === "hero";
  const input = dark
    ? "w-full rounded-lg border border-white/30 bg-white px-4 py-3.5 text-base text-navy outline-none placeholder:text-slate-400 focus:border-white"
    : "w-full rounded-lg border border-slate-300 px-4 py-3.5 text-base text-navy outline-none focus:border-teal";
  const button = dark
    ? "whitespace-nowrap rounded-lg bg-[#0C6B74] px-6 py-3.5 font-semibold text-white shadow-lg transition hover:bg-teal-700 disabled:opacity-60"
    : "whitespace-nowrap rounded-lg bg-teal px-6 py-3.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60";

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcentre.com" aria-label="Email" autoComplete="email" inputMode="email" className={input} />
        <button type="submit" disabled={busy} className={button}>{busy ? "One moment…" : buttonLabel}</button>
      </div>
      <Turnstile onToken={setToken} className="mt-2" />
      {err ? <p className={`mt-2 text-sm ${dark ? "text-amber-200" : "text-port"}`}>{err}</p> : null}
      <p className={`mt-2 text-xs ${dark ? "text-white/70" : "text-slate-500"}`}>
        {variant === "demo" ? "No password, no card. We'll email you once about trying it for free." : "Free for a month · no card · your centre is ready in a minute"}
      </p>
    </form>
  );
}
