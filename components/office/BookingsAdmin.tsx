"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBookingAction, setBookingStatusAction } from "@/app/(app)/office/bookings/actions";
import { StatusPill } from "@/components/ui";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/db/schema";
import type { BookingRow } from "@/lib/services/bookings";

const TONE: Record<BookingStatus, "attention" | "covered" | "neutral" | "conflict"> = {
  provisional: "attention",
  confirmed: "covered",
  paid: "covered",
  cancelled: "conflict",
};
const money = (n: number) => `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BookingsAdmin({
  rows,
  courses,
}: {
  rows: BookingRow[];
  courses: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createBookingAction({
        courseId,
        customerName: name,
        customerEmail: email,
        headcount: Number(headcount),
        amount: amount === "" ? null : Number(amount),
      });
      if (!res.ok) setError(res.error ?? "Could not add booking");
      else { setName(""); setEmail(""); setHeadcount("1"); setAmount(""); router.refresh(); }
    });
  };

  const setStatus = (id: string, status: BookingStatus) =>
    startTransition(async () => {
      const res = await setBookingStatusAction(id, status);
      if (res.ok) router.refresh();
    });

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
        <label className="text-xs text-slate-500">Course
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {courses.length === 0 ? <option value="">No courses</option> : courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Customer
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Places
          <input type="number" min="1" value={headcount} onChange={(e) => setHeadcount(e.target.value)} className="mt-1 block w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-500">Amount £
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="auto" className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button disabled={pending || !courseId} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">Add booking</button>
        {error ? <span className="text-xs text-port">{error}</span> : null}
      </form>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">No bookings yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Places</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-medium text-navy">{b.customerName}</td>
                <td className="px-4 py-3 text-slate-600">{b.courseName}</td>
                <td className="px-4 py-3 text-slate-600">{b.headcount}</td>
                <td className="px-4 py-3 text-slate-600">{money(b.amount)}</td>
                <td className="px-4 py-3"><StatusPill tone={TONE[b.status]}>{b.status[0]!.toUpperCase() + b.status.slice(1)}</StatusPill></td>
                <td className="px-4 py-3 text-right">
                  <select
                    value={b.status}
                    disabled={pending}
                    onChange={(e) => setStatus(b.id, e.target.value as BookingStatus)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    aria-label="Change status"
                  >
                    {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
