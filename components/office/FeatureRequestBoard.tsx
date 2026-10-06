"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleFeatureVoteAction } from "@/app/(app)/office/requests/actions";
import { STATUS_INFO } from "@/lib/validation/feature-request";
import type { FeatureRequestStatus } from "@/lib/db/schema";

export interface BoardCard {
  id: string;
  publicTitle: string;
  kind: "feature" | "problem";
  status: FeatureRequestStatus;
  votes: number;
  mine: boolean;
  voted: boolean;
}

const COLUMNS: FeatureRequestStatus[] = ["in_review", "approved", "in_development", "testing", "live", "not_possible"];

/**
 * The shared board every signed-in centre sees: reviewed requests by stage,
 * titles only, with a "We need this too" count. Which centres sent or backed a
 * request is never shown.
 */
export function FeatureRequestBoard({ items: initial, readOnly }: { items: BoardCard[]; readOnly: boolean }) {
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const vote = (id: string) => {
    setError(null);
    // Show the change at once; the server's answer replaces it.
    setItems((list) => list.map((x) => (x.id === id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x)));
    start(async () => {
      const res = await toggleFeatureVoteAction(id);
      if (!res.ok) { setError(res.error ?? "That didn't save."); setItems(initial); }
    });
  };

  if (!items.length) {
    return <p className="rounded-card border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nothing on the board yet. Requests appear here once we&rsquo;ve reviewed them.</p>;
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-port">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLUMNS.map((status) => {
          const list = items.filter((i) => i.status === status).sort((a, b) => b.votes - a.votes);
          return (
            <section key={status} className="rounded-card border border-slate-200 bg-slate-50/60 p-2.5" aria-label={STATUS_INFO[status].label}>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h3 className="font-display text-sm font-bold text-navy" title={STATUS_INFO[status].hint}>{STATUS_INFO[status].label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? <p className="px-1 py-3 text-center text-xs text-slate-400">None</p> : list.map((i) => (
                  <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-sm font-medium text-navy">{i.publicTitle}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{i.kind === "problem" ? "Problem" : "Feature"}{i.mine ? " · your centre's" : ""}</p>
                    {i.mine || i.status === "live" || i.status === "not_possible" || readOnly ? (
                      <p className="mt-2 text-xs text-slate-500">👍 {i.votes} {i.votes === 1 ? "centre needs" : "centres need"} this{i.mine ? " too" : ""}{i.voted ? " (including you)" : ""}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => vote(i.id)}
                        disabled={pending}
                        aria-pressed={i.voted}
                        className={`mt-2 flex w-full items-center justify-between gap-2 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-70 ${i.voted ? "border-teal bg-teal text-white" : "border-slate-300 text-slate-600 hover:border-teal hover:text-teal"}`}
                      >
                        <span className="whitespace-nowrap">👍 {i.voted ? "You need this too" : "We need this too"}</span>
                        <span className={`font-semibold ${i.voted ? "text-white" : "text-slate-500"}`}>{i.votes}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
