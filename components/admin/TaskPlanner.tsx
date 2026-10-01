"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction, setTaskStatusAction, deleteTaskAction } from "@/app/admin/tasks/actions";

export interface TaskRow {
  id: string;
  title: string;
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  status: "upcoming" | "working" | "complete";
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-port/15 text-port" },
  high: { label: "High", cls: "bg-amber/15 text-amber" },
  medium: { label: "Medium", cls: "bg-teal/15 text-teal" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-500" },
};
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const COLUMNS: { key: TaskRow["status"]; label: string; accent: string }[] = [
  { key: "upcoming", label: "Upcoming", accent: "border-slate-300" },
  { key: "working", label: "Working on", accent: "border-teal" },
  { key: "complete", label: "Complete", accent: "border-starboard" },
];

const fmtDue = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null);
const isOverdue = (iso: string | null, status: string) => Boolean(iso && status !== "complete" && iso < new Date().toISOString().slice(0, 10));

export function TaskPlanner({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else { after?.(); router.refresh(); }
    });
  };

  const add = () => {
    if (!title.trim()) { setErr("Enter a task"); return; }
    run(() => createTaskAction({ title, category, priority, dueDate }), () => { setTitle(""); setCategory(""); setDueDate(""); setPriority("medium"); });
  };

  const sortTasks = (list: TaskRow[]) =>
    [...list].sort((a, b) => (PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]!) || ((a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1));

  const field = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";

  return (
    <div>
      {/* Add task */}
      <div className="mb-6 rounded-card border border-slate-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_9rem_9rem_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="New task…" className={field} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={field} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={field}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          <button onClick={add} disabled={pending} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">Add task</button>
        </div>
        {err ? <p className="mt-2 text-sm text-port">{err}</p> : null}
      </div>

      {/* Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = sortTasks(tasks.filter((t) => t.status === col.key));
          return (
            <div key={col.key} className={`rounded-card border-t-4 ${col.accent} border-x border-b border-slate-200 bg-slate-50/50 p-3`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-navy">{col.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here.</p> : list.map((t) => (
                  <div key={t.id} className={`rounded-lg border border-slate-200 bg-white p-3 ${t.status === "complete" ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium text-navy ${t.status === "complete" ? "line-through" : ""}`}>{t.title}</p>
                      <button onClick={() => run(() => deleteTaskAction(t.id))} disabled={pending} title="Delete" className="text-slate-300 hover:text-port">✕</button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
                      {t.category ? <span className="rounded bg-navy/5 px-1.5 py-0.5 text-[10px] font-medium text-navy/70">{t.category}</span> : null}
                      {t.dueDate ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${isOverdue(t.dueDate, t.status) ? "bg-port/15 text-port" : "bg-slate-100 text-slate-500"}`}>📅 {fmtDue(t.dueDate)}{isOverdue(t.dueDate, t.status) ? " · overdue" : ""}</span> : null}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                        <button key={c.key} onClick={() => run(() => setTaskStatusAction(t.id, c.key))} disabled={pending} className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:border-teal hover:text-teal">
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
