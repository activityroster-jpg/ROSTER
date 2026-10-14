"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { previewUndoAutoRosterAction, undoAutoRosterAction } from "@/app/(app)/office/rota/board-actions";

/** Change log: undo a "Redo the whole week" run (only what it changed), after saying what will change. */
export function UndoRedoButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const undo = () => start(async () => {
    const p = await previewUndoAutoRosterAction(id);
    if (!p.ok || !p.canUndo) { setMsg(p.ok ? p.message ?? "Nothing to undo" : p.error ?? "Couldn't undo"); return; }
    if (!(await askConfirm(p.message ?? "Undo this run?"))) return;
    const r = await undoAutoRosterAction(id);
    setMsg(r.ok ? r.message ?? "Undone" : r.error ?? "Couldn't undo");
    if (r.ok) router.refresh();
  });
  return msg ? <span className="text-xs text-slate-500">{msg}</span> : <button type="button" disabled={pending} onClick={undo} className="text-xs font-semibold text-teal hover:underline disabled:opacity-50">Undo</button>;
}
