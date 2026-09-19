"use client";

import { useCallback, useState } from "react";

const JURISDICTIONS = [
  { value: "england", label: "England" },
  { value: "wales", label: "Wales" },
  { value: "scotland", label: "Scotland" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "ireland", label: "Ireland" },
] as const;

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export function SlugClaim({ apex, plan = "rostering" }: { apex: string; plan?: "rostering" | "full" }) {
  const [slug, setSlug] = useState("");
  const [centreName, setCentreName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [jurisdiction, setJurisdiction] = useState<(typeof JURISDICTIONS)[number]["value"]>("england");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSlug = useCallback(async (value: string) => {
    if (value.length < 3) {
      setAvailability(value.length === 0 ? "idle" : "invalid");
      return;
    }
    setAvailability("checking");
    try {
      const res = await fetch("/api/slug-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: value }),
      });
      const data = (await res.json()) as { available?: boolean; reason?: string };
      if (data.reason === "format" || data.reason === "reserved") setAvailability("invalid");
      else setAvailability(data.available ? "available" : "taken");
    } catch {
      setAvailability("idle");
    }
  }, []);

  const onSlugChange = (raw: string) => {
    const value = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(value);
    void checkSlug(value);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, centreName, ownerEmail, jurisdiction, plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const availabilityLabel: Record<Availability, string> = {
    idle: "",
    checking: "Checking…",
    available: "✓ Available",
    taken: "Already taken",
    invalid: "Not a valid subdomain",
  };
  const availabilityColor: Record<Availability, string> = {
    idle: "",
    checking: "text-slate-400",
    available: "text-starboard",
    taken: "text-port",
    invalid: "text-port",
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-lg rounded-card bg-white p-6 shadow-lg">
      <label className="mb-1 block text-sm font-medium text-navy">Claim your address</label>
      <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 focus-within:border-teal">
        <input
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="yourcentre"
          className="w-full px-3 py-2.5 text-navy outline-none"
          aria-label="Desired subdomain"
        />
        <span className="whitespace-nowrap bg-slate-50 px-3 py-2.5 text-sm text-slate-500">.{apex}</span>
      </div>
      <p className={`mt-1 h-5 text-sm ${availabilityColor[availability]}`}>{availabilityLabel[availability]}</p>

      <div className="mt-3 grid gap-3">
        <input
          value={centreName}
          onChange={(e) => setCentreName(e.target.value)}
          placeholder="Centre name"
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          required
        />
        <input
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          placeholder="Owner email"
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          required
        />
        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value as typeof jurisdiction)}
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
        >
          {JURISDICTIONS.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mt-3 text-sm text-port">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting || availability === "taken" || availability === "invalid"}
        className="mt-4 w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Redirecting to checkout…" : "Start your centre"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        You&apos;ll be provisioned automatically once payment completes.
      </p>
    </form>
  );
}
