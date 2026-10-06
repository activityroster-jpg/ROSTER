"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction, setTaskStatusAction, deleteTaskAction, updateTaskAction } from "@/app/admin/tasks/actions";

export interface TaskRow {
  id: string;
  title: string;
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  status: "upcoming" | "working" | "testing" | "complete";
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
  { key: "testing", label: "Testing", accent: "border-amber" },
  { key: "complete", label: "Complete", accent: "border-starboard" },
];

const fmtDue = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null);
const isOverdue = (iso: string | null, status: string) => Boolean(iso && status !== "complete" && iso < new Date().toISOString().slice(0, 10));

export function TaskPlanner({ tasks: initial }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Local copy so a dragged card or a changed date shows at once; the server copy replaces it after each save.
  const [tasks, setTasks] = useState(initial);
  useEffect(() => setTasks(initial), [initial]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskRow["status"] | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
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

  const move = (id: string, status: TaskRow["status"]) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    setTasks((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
    run(() => setTaskStatusAction(id, status));
  };

  const setDue = (id: string, dueDate: string | null) => {
    setEditingDate(null);
    setTasks((list) => list.map((x) => (x.id === id ? { ...x, dueDate } : x)));
    run(() => updateTaskAction(id, { dueDate }));
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
      <p className="mb-2 text-xs text-slate-400">Drag a card to another column, or use its buttons. Click a date to change it.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = sortTasks(tasks.filter((t) => t.status === col.key));
          return (
            <div
              key={col.key}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col.key) setOverCol(col.key); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; setOverCol(null); setDragId(null); if (id) move(id, col.key); }}
              className={`rounded-card border-t-4 ${col.accent} border-x border-b border-slate-200 p-3 transition-colors ${overCol === col.key ? "bg-teal/5 ring-2 ring-teal/30" : "bg-slate-50/50"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-navy">{col.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here.</p> : list.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 active:cursor-grabbing ${t.status === "complete" ? "opacity-70" : ""} ${dragId === t.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium text-navy ${t.status === "complete" ? "line-through" : ""}`}>{t.title}</p>
                      <button onClick={() => run(() => deleteTaskAction(t.id))} disabled={pending} title="Delete" className="text-slate-300 hover:text-port">✕</button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY[t.priority]?.cls}`}>{PRIORITY[t.priority]?.label}</span>
                      {t.category ? <span className="rounded bg-navy/5 px-1.5 py-0.5 text-[10px] font-medium text-navy/70">{t.category}</span> : null}
                      {editingDate === t.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="date"
                            autoFocus
                            defaultValue={t.dueDate ?? ""}
                            aria-label={`Due date for ${t.title}`}
                            onChange={(e) => { if (e.target.value) setDue(t.id, e.target.value); }}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingDate(null); }}
                            onBlur={() => setEditingDate(null)}
                            className="rounded border border-slate-300 px-1 py-0.5 text-[11px] outline-none focus:border-teal"
                          />
                          {t.dueDate ? <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setDue(t.id, null)} className="text-[10px] font-medium text-slate-400 hover:text-port">Clear</button> : null}
                        </span>
                      ) : t.dueDate ? (
                        <button type="button" onClick={() => setEditingDate(t.id)} title="Change the date" className={`rounded px-1.5 py-0.5 text-[10px] font-medium hover:ring-1 hover:ring-teal/40 ${isOverdue(t.dueDate, t.status) ? "bg-port/15 text-port" : "bg-slate-100 text-slate-500"}`}>📅 {fmtDue(t.dueDate)}{isOverdue(t.dueDate, t.status) ? " · overdue" : ""}</button>
                      ) : (
                        <button type="button" onClick={() => setEditingDate(t.id)} className="rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:border-teal hover:text-teal">+ date</button>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                        <button key={c.key} onClick={() => move(t.id, c.key)} disabled={pending} className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:border-teal hover:text-teal">
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
