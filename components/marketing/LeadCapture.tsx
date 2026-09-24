"use client";

import { useState } from "react";
import Link from "next/link";

const JURISDICTIONS = [
  { value: "england", label: "England" },
  { value: "wales", label: "Wales" },
  { value: "scotland", label: "Scotland" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "ireland", label: "Ireland" },
] as const;

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);

export function LeadCapture({
  source = "marketing",
  variant = "card",
  apex = "activityroster.com",
}: {
  source?: string;
  variant?: "card" | "inline";
  apex?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [centreName, setCentreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<(typeof JURISDICTIONS)[number]["value"]>("england");
  const [setupMode, setSetupMode] = useState<"basic" | "full">("basic");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailSent: boolean; emailError?: string } | null>(null);

  const onCentreName = (v: string) => {
    setCentreName(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slug.length < 3) { setError("Choose a web address of at least 3 characters."); return; }
    if (password.length < 8) { setError("Choose a password of at least 8 characters."); return; }
    setStatus("busy");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerEmail: email, password, centreName, slug, jurisdiction, setupMode, source }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string; url?: string; emailSent?: boolean; emailError?: string };
      if (!res.ok || !data.ok) {
        setError([data.error, data.detail].filter(Boolean).join(" — ") || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setResult({ url: data.url ?? `https://${slug}.${apex}`, emailSent: data.emailSent ?? false, emailError: data.emailError });
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "done" && result) {
    return (
      <div className={variant === "card" ? "rounded-card bg-white p-6 shadow-lg" : ""}>
        <p className="font-display text-xl font-semibold text-navy">
          {result.emailSent ? "📩 Confirm your email" : "✅ Your centre is ready"}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Your centre <span className="font-semibold text-navy">{centreName}</span> is set up at{" "}
          <span className="font-semibold text-navy">{slug}.{apex}</span>.{" "}
          {result.emailSent
            ? <>We&apos;ve emailed a confirmation link to <span className="font-semibold">{email}</span> — click it to verify and you&apos;ll be taken straight in.</>
            : <>Sign in with <span className="font-semibold">{email}</span> and the password you just set.</>}
        </p>
        <p className="mt-3 rounded-lg bg-canvas p-3 text-xs text-slate-500">
          {result.emailSent ? <>Didn&apos;t get it? Check spam, or sign in at </> : <>Go to </>}
          <a href={`${result.url}/sign-in`} className="font-semibold text-teal hover:underline">{slug}.{apex}/sign-in</a>.
        </p>
        {result.emailError ? (
          <p className="mt-2 text-xs text-port">Confirmation email couldn&apos;t send: {result.emailError}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          {setupMode === "basic"
            ? "Set up with RYA defaults — you can start rostering as soon as you're in."
            : "Your full setup checklist will be waiting in the office."}
        </p>
      </div>
    );
  }

  const wrapCls = variant === "card" ? "w-full max-w-md rounded-card bg-white p-6 shadow-lg" : "w-full";
  const field = "rounded-lg border border-slate-300 px-3 py-2.5 text-navy outline-none focus:border-teal";

  return (
    <form onSubmit={submit} className={wrapCls}>
      {variant === "card" ? (
        <>
          <p className="font-display text-lg font-semibold text-navy">Start your free month</p>
          <p className="mb-4 mt-1 text-sm text-slate-600">No card required. Your centre is created instantly.</p>
        </>
      ) : null}
      <div className="grid gap-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcentre.com" className={field} aria-label="Email" autoComplete="email" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (8+ characters)" className={field} aria-label="Password" autoComplete="new-password" />
        <input required value={centreName} onChange={(e) => onCentreName(e.target.value)} placeholder="Centre / club name" className={field} aria-label="Centre name" />

        {/* Web address */}
        <div className="flex items-stretch rounded-lg border border-slate-300 focus-within:border-teal">
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
            placeholder="yourclub"
            className="w-0 flex-1 rounded-l-lg px-3 py-2.5 text-navy outline-none"
            aria-label="Your web address"
          />
          <span className="flex items-center rounded-r-lg bg-slate-50 px-3 text-sm text-slate-500">.{apex}</span>
        </div>

        <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as typeof jurisdiction)} className={field} aria-label="Jurisdiction">
          {JURISDICTIONS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
        </select>

        {/* Setup choice */}
        <div className="grid grid-cols-2 gap-2">
          {([
            ["basic", "Quick setup", "RYA defaults — start now, tweak later"],
            ["full", "Full setup", "Do all my setup now"],
          ] as const).map(([value, title, sub]) => (
            <button
              type="button"
              key={value}
              onClick={() => setSetupMode(value)}
              className={`rounded-lg border p-3 text-left ${setupMode === value ? "border-teal bg-teal/5" : "border-slate-300 hover:border-slate-400"}`}
            >
              <span className="block text-sm font-semibold text-navy">{title}</span>
              <span className="block text-xs text-slate-500">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-port">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={status === "busy"} className="rounded-lg bg-teal px-5 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50">
          {status === "busy" ? "Setting up…" : "Start my free month"}
        </button>
        <Link href="/demo" className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-navy hover:bg-slate-50">
          Explore the demo first
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-500">Free for a month · no card required · cancel anytime.</p>
    </form>
  );
}
