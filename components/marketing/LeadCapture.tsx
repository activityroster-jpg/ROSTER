"use client";

import { useEffect, useState } from "react";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Turnstile } from "@/components/auth/Turnstile";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

const JURISDICTIONS = [
  { value: "england", label: "England" },
  { value: "wales", label: "Wales" },
  { value: "scotland", label: "Scotland" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "ireland", label: "Ireland" },
  { value: "other", label: "Other / outside UK & Ireland" },
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const [centreName, setCentreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<(typeof JURISDICTIONS)[number]["value"]>("england");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [resending, setResending] = useState(false);
  // Provisioning takes a few seconds (web address, login, centre, RYA defaults, email).
  // The bar advances through those stages on a timer and holds at 90% until the server
  // answers, so people can see something is happening rather than a frozen button.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (status !== "busy") { setProgress(0); return; }
    setProgress(8);
    const t = setInterval(() => setProgress((p) => (p >= 90 ? 90 : p + (p < 40 ? 6 : p < 70 ? 3 : 1))), 350);
    return () => clearInterval(t);
  }, [status]);
  const stage = progress < 20 ? "Reserving your web address…" : progress < 45 ? "Creating your login and your centre…" : progress < 75 ? "Loading the RYA course types, roles and checks…" : "Sending your confirmation email…";
  const [resent, setResent] = useState<string | null>(null);
  const resend = async () => {
    setResending(true); setResent(null);
    try {
      const r = await authClient.sendVerificationEmail({ email, callbackURL: `${result?.url ?? ""}/office` });
      setResent(r.error ? "Could not resend — try signing in instead." : "Sent again.");
    } catch { setResent("Could not resend — try signing in instead."); }
    finally { setResending(false); }
  };

  const onCentreName = (v: string) => {
    setCentreName(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (slug.length < 3) { setError("Choose a web address of at least 3 characters."); return; }
    if (password.length < 8) { setError("Choose a password of at least 8 characters."); return; }
    if (!acceptedTerms) { setError("Please agree to the Terms and Privacy Policy to continue."); return; }
    setStatus("busy");
    try {
      setTsReset((n) => n + 1);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerEmail: email, password, centreName, slug, jurisdiction, acceptedTerms, source, turnstileToken }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; url?: string; emailSent?: boolean };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setResult({ url: data.url ?? `https://${slug}.${apex}`, emailSent: data.emailSent ?? false });
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
          {result.emailSent ? (
            <>
              {" "}
              <button type="button" onClick={resend} disabled={resending} className="font-semibold text-teal hover:underline disabled:opacity-50">{resending ? "Sending…" : "Resend the email"}</button>
              {resent ? <span className="ml-1 text-starboard">{resent}</span> : null}
            </>
          ) : null}
        </p>
        <p className="mt-3 text-xs text-slate-500">Your centre starts with the RYA course types, roles and checks already in place. A short set-up wizard in the office walks you through the rest.</p>
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
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className={field} aria-label="Password" autoComplete="new-password" />
        <PasswordStrength password={password} className="mt-1" />
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
        <p className="-mt-1 text-xs text-slate-500">This is your centre&apos;s permanent web address — pick something short your team will recognise. It can&apos;t be changed later.</p>

        <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as typeof jurisdiction)} className={field} aria-label="Jurisdiction">
          {JURISDICTIONS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
        </select>

      </div>

      <label className="mt-4 flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded border-slate-300 text-teal focus:ring-teal"
          aria-label="Agree to the Terms and Privacy Policy"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-teal hover:underline">Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-semibold text-teal hover:underline">Privacy Policy</Link>.
        </span>
      </label>

      {error ? <p className="mt-3 text-sm text-port">{error}</p> : null}

      {status === "busy" ? (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-600">{stage} <span className="text-slate-400">This takes a few seconds.</span></p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Turnstile onToken={setTurnstileToken} resetKey={tsReset} className="my-2" />
        <button type="submit" disabled={status === "busy" || !acceptedTerms} className="w-full rounded-lg bg-teal px-5 py-3.5 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50 sm:w-auto">
          {status === "busy" ? "Setting up…" : "Start my free month"}
        </button>
        <Link href="/demo" className="hidden rounded-lg border border-slate-300 px-5 py-3 font-semibold text-navy hover:bg-slate-50 md:inline-block">
          Explore the demo first
        </Link>
      </div>
      {!acceptedTerms && status !== "busy" ? <p className="mt-2 text-xs text-slate-500">Tick the box above to agree to the terms, then start.</p> : null}
      <p className="mt-2 text-xs text-slate-500">Free for a month · no card required · cancel anytime.</p>
    </form>
  );
}
