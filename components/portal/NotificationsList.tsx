"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllReadAction, markReadAction } from "@/app/(app)/portal/notifications/actions";

export interface NotificationUi {
  id: string;
  title: string;
  body: string | null;
  when: string;
  read: boolean;
}

export function NotificationsList({ items: initial }: { items: NotificationUi[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const anyUnread = items.some((i) => !i.read);

  const readOne = (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
    startTransition(async () => {
      const res = await markReadAction(id);
      if (res.ok) router.refresh();
    });
  };
  const readAll = () => {
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    startTransition(async () => {
      const res = await markAllReadAction();
      if (res.ok) router.refresh();
    });
  };

  if (items.length === 0) return <p className="text-sm text-slate-400">No notifications yet.</p>;

  return (
    <div>
      {anyUnread ? (
        <button onClick={readAll} disabled={pending} className="mb-3 text-sm font-semibold text-teal hover:underline disabled:opacity-60">
          Mark all read
        </button>
      ) : null}
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => !n.read && readOne(n.id)}
              className={`w-full rounded-card border px-3 py-3 text-left transition ${n.read ? "border-slate-200 bg-white" : "border-teal/30 bg-teal/5"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${n.read ? "font-medium text-navy" : "font-semibold text-navy"}`}>{n.title}</p>
                {!n.read ? <span className="mt-1 h-2 w-2 flex-none rounded-full bg-teal" /> : null}
              </div>
              {n.body ? <p className="mt-0.5 text-sm text-slate-600">{n.body}</p> : null}
              <p className="mt-1 text-xs text-slate-400">{n.when}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
