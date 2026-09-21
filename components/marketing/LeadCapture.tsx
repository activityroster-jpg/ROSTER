"use client";

import { useState } from "react";
import Link from "next/link";

const ORG_TYPES = [
  { value: "yacht_club", label: "Yacht club" },
  { value: "sailing_school", label: "Sailing school" },
  { value: "activity_centre", label: "Activity centre" },
  { value: "other", label: "Other" },
] as const;

export function LeadCapture({
  source = "marketing",
  variant = "card",
}: {
  source?: string;
  variant?: "card" | "inline";
}) {
  const [email, setEmail] = useState("");
  const [centreName, setCentreName] = useState("");
  const [orgType, setOrgType] = useState<(typeof ORG_TYPES)[number]["value"]>("sailing_school");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("busy");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, centreName, orgType, source }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className={variant === "card" ? "rounded-card bg-white p-6 shadow-lg" : ""}>
        <p className="font-display text-xl font-semibold text-navy">You&apos;re on the list ⚓</p>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ll be in touch shortly. In the meantime, jump straight into the interactive demo — no login needed.
        </p>
        <Link
          href="/demo"
          className="mt-4 inline-block rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-teal-700"
        >
          Open the live demo →
        </Link>
      </div>
    );
  }

  const wrapCls = variant === "card" ? "w-full max-w-md rounded-card bg-white p-6 shadow-lg" : "w-full";

  return (
    <form onSubmit={submit} className={wrapCls}>
      {variant === "card" ? (
        <>
          <p className="font-display text-lg font-semibold text-navy">See it on your own courses</p>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Get a free walkthrough and instant access to the interactive demo.
          </p>
        </>
      ) : null}
      <div className="grid gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcentre.com"
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          aria-label="Email"
        />
        <input
          value={centreName}
          onChange={(e) => setCentreName(e.target.value)}
          placeholder="Centre / club name"
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          aria-label="Centre name"
        />
        <select
          value={orgType}
          onChange={(e) => setOrgType(e.target.value as typeof orgType)}
          className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal"
          aria-label="Type of organisation"
        >
          {ORG_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="mt-3 text-sm text-port">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={status === "busy"}
          className="rounded-lg bg-teal px-5 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          {status === "busy" ? "Sending…" : "Get my free demo"}
        </button>
        <Link
          href="/demo"
          className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-navy hover:bg-slate-50"
        >
          Skip — just show me
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-500">No card required. Unsubscribe anytime.</p>
    </form>
  );
}
