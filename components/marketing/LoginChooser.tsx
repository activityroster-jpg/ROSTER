"use client";

import { useEffect, useState } from "react";

type Who = "admin" | "instructor";
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Apex-site sign-in chooser. Each centre lives on its own subdomain, so we ask
 * which centre and whether they run it (Office) or work there (Portal), then
 * send them to that centre's own sign-in page. The slug is checked against
 * the public slug-check route so a typo gets a clear message, not a 404.
 */
export function LoginChooser({ apex }: { apex: string }) {
  const [who, setWho] = useState<Who>("admin");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("ar.centre.slug");
      if (s) setSlug(s);
      if (window.localStorage.getItem("ar.centre.who") === "instructor") setWho("instructor");
    } catch { /* blocked storage */ }
  }, []);

  const clean = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(new RegExp(`\\.${apex.replace(/\./g, "\\.")}.*$`), "").replace(/\/.*$/, "");

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = clean(slug);
    if (!s) { setError("Enter your centre's web address, e.g. westbay"); return; }
    if (!SLUG.test(s)) { setError("That doesn't look like a centre address. It's the first part before ." + apex + ", letters, numbers and hyphens only."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/slug-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: s }) });
      const data = (await res.json().catch(() => ({}))) as { available?: boolean; reason?: string };
      if (data.available === true || data.reason === "reserved" || data.reason === "format") {
        setError(`We can't find a centre at ${s}.${apex}. Check the address in your invite email, or ask your centre admin.`);
        return;
      }
      try { window.localStorage.setItem("ar.centre.slug", s); window.localStorage.setItem("ar.centre.who", who); } catch { /* ignore */ }
      window.location.href = `https://${s}.${apex}/sign-in?next=${who === "admin" ? "/office" : "/portal"}`;
    } catch {
      // If the check itself fails, still send them on: the centre's own page handles unknowns.
      window.location.href = `https://${s}.${apex}/sign-in?next=${who === "admin" ? "/office" : "/portal"}`;
    } finally { setBusy(false); }
  };

  const card = (w: Who, title: string, body: string) => (
    <button type="button" onClick={() => setWho(w)} aria-pressed={who === w} className={`rounded-card border p-5 text-left transition ${who === w ? "border-teal bg-teal/5 ring-2 ring-teal/30" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <p className="font-display text-lg font-semibold text-navy">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </button>
  );

  return (
    <form onSubmit={go} className="mx-auto max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        {card("admin", "Centre admin", "Run the roster, courses, team, documents and billing for your centre.")}
        {card("instructor", "Instructor portal", "See your shifts, set availability, confirm sessions, clock in and request leave.")}
      </div>
      <div className="mt-5 rounded-card border border-slate-200 bg-white p-5">
        <label htmlFor="centre" className="block text-sm font-medium text-navy">Your centre&rsquo;s web address</label>
        <div className="mt-2 flex items-stretch overflow-hidden rounded-lg border border-slate-300 focus-within:border-teal">
          <span className="hidden items-center bg-slate-50 px-3 text-sm text-slate-500 sm:flex">https://</span>
          <input id="centre" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="yourcentre" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="min-w-0 flex-1 px-3 py-2.5 outline-none" />
          <span className="flex items-center bg-slate-50 px-3 text-sm text-slate-500">.{apex}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">It&rsquo;s in the invite email your centre sent you, and in the address bar whenever you&rsquo;re signed in.</p>
        {error ? <p className="mt-2 text-sm text-port">{error}</p> : null}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-lg bg-teal px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Checking…" : who === "admin" ? "Go to my centre's office sign-in" : "Go to my portal sign-in"}
        </button>
      </div>
      {who === "instructor" ? (
        <p className="mt-4 text-center text-sm text-slate-500">On your phone? The <a href="/app" className="font-semibold text-teal hover:underline">ActivityRoster app</a> finds your centre for you once you sign in.</p>
      ) : (
        <p className="mt-4 text-center text-sm text-slate-500">New here? <a href="/#get-demo" className="font-semibold text-teal hover:underline">Start your free month</a> and your centre is created instantly.</p>
      )}
    </form>
  );
}
