"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { Turnstile } from "@/components/auth/Turnstile";
import { authClient } from "@/lib/auth/client";
import { SignOutLink } from "@/components/SignOutLink";

const JURISDICTIONS = [
  { value: "england", label: "England" },
  { value: "wales", label: "Wales" },
  { value: "scotland", label: "Scotland" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "ireland", label: "Ireland" },
  { value: "other", label: "Other / outside UK & Ireland" },
] as const;

/** Kept in step with lib/packs (PACK_OPTIONS): the kind of centre, which sets up its starting lists. */
const ACTIVITY_TYPES = [
  { value: "rya_centre", label: "RYA centre / club" },
  { value: "padi_centre", label: "PADI dive centre" },
] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];
type Jurisdiction = (typeof JURISDICTIONS)[number]["value"];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);

/**
 * /start: the sign-up in two short steps. Step one is the email (already done
 * when the person arrives from a box on another page); step two is the password
 * and the centre's name. The web address is made from the name and can be
 * changed here or, once, within 30 days in Settings. Agreeing to the terms is
 * by continuing, so the button works from the start.
 */
export function StartSignup({
  apex,
  initialEmail = "",
  source = "start",
  leadCaptured = false,
  plan,
  defaultActivityType = "rya_centre",
  signedInAs = null,
  runs = [],
}: {
  apex: string;
  initialEmail?: string;
  source?: string;
  leadCaptured?: boolean;
  plan?: string;
  defaultActivityType?: ActivityType;
  /** Already signed in: the centre is created for this login, with no new password. */
  signedInAs?: string | null;
  /** Centres this login already runs, so a second click on "try free" doesn't make a duplicate by accident. */
  runs?: { name: string; slug: string }[];
}) {
  const [step, setStep] = useState<1 | 2>(initialEmail ? 2 : 1);
  const [existsElsewhere, setExistsElsewhere] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [lead, setLead] = useState(leadCaptured);
  const [password, setPassword] = useState("");
  const [centreName, setCentreName] = useState("");
  const [slug, setSlug] = useState("");
  const [editSlug, setEditSlug] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("england");
  const [activityType, setActivityType] = useState<ActivityType>(defaultActivityType);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tsReset, setTsReset] = useState(0);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  // Provisioning takes a few seconds; the bar moves through the stages and holds at 90% until the server answers.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (status !== "busy") { setProgress(0); return; }
    setProgress(8);
    const t = setInterval(() => setProgress((p) => (p >= 90 ? 90 : p + (p < 40 ? 6 : p < 70 ? 3 : 1))), 350);
    return () => clearInterval(t);
  }, [status]);
  const stage = progress < 20 ? "Reserving your web address…" : progress < 45 ? "Creating your login and your centre…" : progress < 75 ? "Loading the course types, roles and checks…" : "Sending your confirmation email…";

  const onCentreName = (v: string) => { setCentreName(v); if (!editSlug) setSlug(slugify(v)); };

  const stepOne = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setError("Enter your email address to start."); return; }
    setEmail(clean);
    if (!lead) {
      try {
        const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: clean, source, turnstileToken }) });
        if (res.ok) setLead(true);
      } catch { /* the sign-up itself is what matters */ }
      setTsReset((n) => n + 1);
    }
    setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setExistsElsewhere(false);
    if (!signedInAs && password.length < 8) { setError("Choose a password of at least 8 characters, with letters and numbers."); return; }
    if (centreName.trim().length < 2) { setError("Enter your centre or club's name."); return; }
    if (slug.length < 3) { setError("Your web address needs at least 3 characters."); return; }
    setStatus("busy");
    try {
      setTsReset((n) => n + 1);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: email, ...(signedInAs ? {} : { password }), centreName: centreName.trim(), slug, jurisdiction, activityType, acceptedTerms: true, source, tier: plan, turnstileToken,
          timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string; url?: string; emailSent?: boolean };
      if (!res.ok || !data.ok) { setError(data.error || "Something went wrong. Please try again."); setExistsElsewhere(data.code === "exists"); setStatus("error"); return; }
      setResult({ url: data.url ?? `https://${slug}.${apex}`, emailSent: data.emailSent ?? false });
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  const resend = async () => {
    setResending(true); setResent(null);
    try {
      const r = await authClient.sendVerificationEmail({ email, callbackURL: `${result?.url ?? ""}/office` });
      setResent(r.error ? "Could not resend — try signing in instead." : "Sent again.");
    } catch { setResent("Could not resend — try signing in instead."); }
    finally { setResending(false); }
  };

  const field = "w-full rounded-lg border border-slate-300 px-4 py-3 text-base text-navy outline-none focus:border-teal";
  const button = "w-full rounded-lg bg-teal px-5 py-3.5 text-base font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60";

  if (status === "done" && result && signedInAs) {
    return (
      <div className="rounded-card bg-white p-6 shadow-lg">
        <p className="font-display text-xl font-semibold text-navy">✅ Your centre is ready</p>
        <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-navy">{centreName}</span> is set up at <span className="font-semibold text-navy">{slug}.{apex}</span>. You&apos;re already signed in, so go straight in; a short set-up takes it from there.</p>
        <a href={`${result.url}/office`} className={`${button} mt-4 inline-block text-center`}>Open my centre →</a>
      </div>
    );
  }
  if (status === "done" && result) {
    return (
      <div className="rounded-card bg-white p-6 shadow-lg">
        <p className="font-display text-xl font-semibold text-navy">{result.emailSent ? "📩 One more step: confirm your email" : "✅ Your centre is ready"}</p>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-navy">{centreName}</span> is set up at <span className="font-semibold text-navy">{slug}.{apex}</span>.{" "}
          {result.emailSent
            ? <>We&apos;ve emailed a confirmation link to <span className="font-semibold">{email}</span>. Click it and you&apos;re in; a short set-up takes it from there.</>
            : <>Sign in with <span className="font-semibold">{email}</span> and the password you just chose.</>}
        </p>
        <p className="mt-3 rounded-lg bg-canvas p-3 text-xs text-slate-500">
          {result.emailSent ? <>Didn&apos;t get it? Check spam, or sign in at </> : <>Go to </>}
          <a href={`${result.url}/sign-in`} className="font-semibold text-teal hover:underline">{slug}.{apex}/sign-in</a>.
          {result.emailSent ? <>{" "}<button type="button" onClick={resend} disabled={resending} className="font-semibold text-teal hover:underline disabled:opacity-50">{resending ? "Sending…" : "Resend the email"}</button>{resent ? <span className="ml-1 text-starboard">{resent}</span> : null}</> : null}
        </p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <form onSubmit={stepOne} className="rounded-card bg-white p-6 shadow-lg">
        <p className="font-display text-lg font-semibold text-navy">Start your free month</p>
        <p className="mb-4 mt-1 text-sm text-slate-600">Step 1 of 2: your email. No card, and your centre is ready in a minute.</p>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcentre.com" aria-label="Email" autoComplete="email" inputMode="email" autoFocus className={field} />
        <Turnstile onToken={setTurnstileToken} resetKey={tsReset} className="my-3" />
        {error ? <p className="mb-3 text-sm text-port">{error}</p> : null}
        <button type="submit" className={button}>Continue →</button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-card bg-white p-6 shadow-lg">
      <p className="font-display text-lg font-semibold text-navy">Nearly there</p>
      {signedInAs ? (
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Creating the centre for <span className="font-medium text-navy">{signedInAs}</span>, which you&apos;re signed in as. No new password needed.{" "}
          <span className="text-xs text-slate-400">Not you? <SignOutLink /></span>
        </p>
      ) : (
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Step 2 of 2 for <span className="font-medium text-navy">{email}</span>{" "}
          <button type="button" onClick={() => { setStep(1); setError(null); }} className="text-xs font-semibold text-teal hover:underline">(change)</button>
        </p>
      )}
      {runs.length ? (
        <p className="mb-4 rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 text-xs text-navy">
          You already run <span className="font-semibold">{runs.map((r) => r.name).join(" and ")}</span>: <a href={`https://${runs[0]!.slug}.${apex}/office`} className="font-semibold text-teal hover:underline">open it</a>. Carry on here only to set up another centre.
        </p>
      ) : null}
      <div className="grid gap-3">
        {signedInAs ? null : (
          <div>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" aria-label="Password" autoComplete="new-password" autoFocus className={field} />
            <PasswordStrength password={password} />
          </div>
        )}
        <input required value={centreName} onChange={(e) => onCentreName(e.target.value)} placeholder="Centre or club name" aria-label="Centre name" className={field} />
        {editSlug ? (
          <div>
            <div className="flex items-stretch rounded-lg border border-slate-300 focus-within:border-teal">
              <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="yourclub" aria-label="Your web address" autoFocus className="w-0 flex-1 rounded-l-lg px-4 py-3 text-base text-navy outline-none" />
              <span className="flex items-center rounded-r-lg bg-slate-50 px-3 text-sm text-slate-500">.{apex}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Short and recognisable; your team will type it. You can change it once more within 30 days, in Settings.</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Your web address will be <span className="font-semibold text-navy">{slug || "yourclub"}.{apex}</span>{" "}
            <button type="button" onClick={() => setEditSlug(true)} className="font-semibold text-teal hover:underline">(change)</button>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)} className={field} aria-label="What kind of centre">
            {ACTIVITY_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)} className={field} aria-label="Where you are">
            {JURISDICTIONS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
          </select>
        </div>
        <p className="-mt-1 text-xs text-slate-500">The kind of centre sets up your course list and instructor types; where you are sets the vetting checks (DBS, PVG, AccessNI or Garda), currency and clock.</p>
      </div>

      {error ? <p className="mt-3 text-sm text-port">{error}{existsElsewhere ? <> <a href="/sign-in?next=%2Fstart" className="font-semibold text-teal underline">Sign in and come back →</a></> : null}</p> : null}
      {status === "busy" ? (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1.5 text-xs text-slate-600">{stage} <span className="text-slate-400">This takes a few seconds.</span></p>
        </div>
      ) : null}
      <Turnstile onToken={setTurnstileToken} resetKey={tsReset} className="my-3" />
      <button type="submit" disabled={status === "busy"} className={button}>{status === "busy" ? "Setting up…" : "Create my centre"}</button>
      <p className="mt-3 text-center text-xs text-slate-500">
        By continuing you agree to the <Link href="/terms" target="_blank" className="font-semibold text-teal hover:underline">Terms</Link> and <Link href="/privacy" target="_blank" className="font-semibold text-teal hover:underline">Privacy Policy</Link>. Free for a month, no card, cancel any time.
      </p>
    </form>
  );
}
