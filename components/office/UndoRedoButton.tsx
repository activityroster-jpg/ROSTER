"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askConfirm } from "@/lib/ui/ask-confirm";
import { undoAutoRosterAction } from "@/app/(app)/office/rota/board-actions";

/** Change log: put a week back as it was before a "Redo the whole week" run. */
export function UndoRedoButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const undo = () => start(async () => {
    if (!(await askConfirm("Put this week back as it was before the redo? People whose shifts change on confirmed days are told."))) return;
    const r = await undoAutoRosterAction(id);
    setMsg(r.ok ? r.message ?? "Undone" : r.error ?? "Couldn't undo");
    if (r.ok) router.refresh();
  });
  return msg ? <span className="text-xs text-slate-500">{msg}</span> : <button type="button" disabled={pending} onClick={undo} className="text-xs font-semibold text-teal hover:underline disabled:opacity-50">Undo</button>;
}
