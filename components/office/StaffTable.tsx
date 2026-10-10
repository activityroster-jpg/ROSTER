"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronsUpDown } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { InviteInstructorButton } from "@/components/office/InviteInstructorButton";
import { RemindButton } from "@/components/office/RemindButton";

export interface StaffRow {
  id: string;
  name: string;
  email: string | null;
  employment: string;
  fit: boolean;
  warnings: number;
  blockText: string;
  /** Licences or checks running out soon, by name. */
  expiringText?: string;
  /** Whether they have any availability on file (a dated answer or a usual week). */
  hasAvailability?: boolean;
  linked: boolean;
  /** Portal access: none yet, invite sent but not accepted, or accepted. */
  inviteStatus: "none" | "pending" | "accepted";
  /** The office keeps their availability; they don't need to sign up. */
  officeManaged?: boolean;
  /** When the latest invitation went out (epoch ms), if we know. */
  inviteSentAt?: number | null;
  /** Held back by the centre's daily invite limit; goes out tomorrow. */
  inviteQueued?: boolean;
  /** Under-18s: where the parent's approval stands. */
  parentApproval?: "approved" | "pending" | "declined" | "withdrawn" | "none" | "not-needed";
  hasEmail: boolean;
  teaches: string[];
  teachesYouth: boolean;
  teachesAdult: boolean;
  /** "inactive" = has left; kept for history, hidden from pickers. */
  status: string;
  under18?: boolean;
  hasDob?: boolean;
  restricted?: boolean;
  anonymised?: boolean;
}

type Tab = "all" | "fit" | "blocked" | "expiring" | "left";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Current" },
  { key: "fit", label: "Licences up to date" },
  { key: "blocked", label: "Needs a licence update" },
  { key: "expiring", label: "Expiring soon" },
  { key: "left", label: "Left" },
];

export function StaffTable({ rows }: { rows: StaffRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const current = useMemo(() => rows.filter((r) => r.status !== "inactive"), [rows]);
  const counts = useMemo(
    () => ({
      all: current.length,
      fit: current.filter((r) => r.fit).length,
      blocked: current.filter((r) => !r.fit).length,
      expiring: current.filter((r) => r.warnings > 0).length,
      left: rows.length - current.length,
    }),
    [rows, current],
  );

  // Who a reminder can reach: availability needs the app; licences go by app or email.
  const canRemind = (r: StaffRow) => r.status === "active" && !r.restricted && !r.anonymised;
  const needsAvailability = (r: StaffRow) => canRemind(r) && !r.officeManaged && !r.hasAvailability && r.inviteStatus === "accepted";
  const needsLicences = (r: StaffRow) => canRemind(r) && (!r.fit || r.warnings > 0) && (r.inviteStatus === "accepted" || r.hasEmail);
  const availabilityTodo = useMemo(() => current.filter(needsAvailability).map((r) => r.id), [current]);
  const licencesTodo = useMemo(() => current.filter(needsLicences).map((r) => r.id), [current]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const gone = r.status === "inactive";
      if (tab === "left") { if (!gone) return false; }
      else if (gone) return false;
      if (tab === "fit" && !r.fit) return false;
      if (tab === "blocked" && r.fit) return false;
      if (tab === "expiring" && r.warnings === 0) return false;
      if (term && !`${r.name} ${r.email ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, tab, q]);

  return (
    <div className="rounded-card border border-slate-200 bg-white shadow-sm">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {TABS.filter((t) => t.key !== "left" || counts.left > 0).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.key ? "bg-teal text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${tab === t.key ? "text-white/80" : "text-slate-400"}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff by name or email"
            className="w-64 max-w-[70vw] rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal focus:bg-white"
            aria-label="Search staff"
          />
        </div>
      </div>

      {tab !== "left" && (availabilityTodo.length || licencesTodo.length) ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
          <span className="font-medium">Send reminders:</span>
          {availabilityTodo.length ? <RemindButton variant="button" kind="availability" instructorIds={availabilityTodo} label={`Everyone who hasn't set availability (${availabilityTodo.length})`} confirm={`Remind ${availabilityTodo.length} ${availabilityTodo.length === 1 ? "person" : "people"} to mark when they're free? They get a notice in the app and an email.`} /> : null}
          {licencesTodo.length ? <RemindButton variant="button" kind="licences" instructorIds={licencesTodo} label={`Everyone who needs a licence update (${licencesTodo.length})`} confirm={`Remind ${licencesTodo.length} ${licencesTodo.length === 1 ? "person" : "people"} to update their licences? They get a notice in the app and an email listing what's missing or running out.`} /> : null}
        </div>
      ) : null}

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Has set availability</Th>
              <Th>Needs to update licences</Th>
              <Th>App access</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">{tab === "left" ? "Nobody has left." : "No instructors match this view."}</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="transition hover:bg-navy-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">
                        {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5"><Link href={`/office/staff/${r.id}`} className="font-medium text-navy hover:text-teal hover:underline">{r.name}</Link>{r.under18 ? <span className="flex-none whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Under 18</span> : null}{r.hasDob === false && !r.anonymised ? <span className="flex-none whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500" title="Add their date of birth so the right protections and hours rules apply">No DOB</span> : null}{r.restricted ? <span className="flex-none whitespace-nowrap rounded-full bg-port/10 px-1.5 py-0.5 text-[10px] font-semibold text-port" title="Processing restricted: not rostered or contacted">Restricted</span> : null}{r.anonymised ? <span className="flex-none whitespace-nowrap rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Anonymised</span> : null}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.status === "inactive" ? <span className="text-xs text-slate-400">—</span>
                      : r.officeManaged ? <span className="text-slate-500" title="The office keeps their availability">Office keeps it</span>
                      : r.hasAvailability ? <span className="text-starboard">✓ Yes</span>
                      : (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-amber">Not yet</span>
                          {needsAvailability(r) ? <RemindButton kind="availability" instructorIds={[r.id]} /> : r.inviteStatus !== "accepted" && canRemind(r) ? <span className="text-xs text-slate-400" title="They need the app to mark when they're free: invite them under App access">not signed up</span> : null}
                        </span>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "inactive" ? <StatusPill tone="neutral">Left</StatusPill> : (
                      <div className="flex flex-wrap gap-1.5">
                        {!r.fit ? <StatusPill tone="conflict">{r.blockText || "Missing a licence or check"}</StatusPill> : null}
                        {r.warnings > 0 ? <span title={r.expiringText}><StatusPill tone="attention">{r.expiringText ? `${r.expiringText} expiring` : `${r.warnings} expiring`}</StatusPill></span> : null}
                        {r.fit && r.warnings === 0 ? <span className="text-sm text-starboard">✓ Up to date</span> : null}
                        {needsLicences(r) ? <RemindButton kind="licences" instructorIds={[r.id]} /> : null}
                        {r.parentApproval && r.parentApproval !== "not-needed" ? (
                          <span title="Parent or guardian's approval to work"><StatusPill tone={r.parentApproval === "approved" ? "covered" : r.parentApproval === "pending" ? "attention" : "conflict"}>{r.parentApproval === "approved" ? "Parent approved" : r.parentApproval === "pending" ? "Parent approval pending" : r.parentApproval === "none" ? "No parent invited" : `Parent ${r.parentApproval}`}</StatusPill></span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "inactive" ? (
                      <span className="text-xs text-slate-400">Access ended</span>
                    ) : r.officeManaged && r.inviteStatus === "none" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600" title="The office keeps their availability; they don't need the app">No sign-up needed</span>
                        {r.hasEmail ? <InviteInstructorButton instructorId={r.id} status={r.inviteStatus} sentAt={r.inviteSentAt ?? null} queued={r.inviteQueued ?? false} /> : null}
                      </div>
                    ) : r.hasEmail ? (
                      <InviteInstructorButton instructorId={r.id} status={r.inviteStatus} sentAt={r.inviteSentAt ?? null} queued={r.inviteQueued ?? false} />
                    ) : (
                      <span className="text-xs text-slate-400">Add email to invite</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3">
      <span className="inline-flex items-center gap-1">
        {children}
        <ChevronsUpDown className="h-3 w-3 text-slate-300" />
      </span>
    </th>
  );
}
