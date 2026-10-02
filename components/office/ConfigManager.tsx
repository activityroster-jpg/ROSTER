"use client";

import { useActionState, useState } from "react";
import { addConfigAction, setConfigActiveAction, setConfigNameAction, type ActionState, type ConfigKind } from "@/app/(app)/office/settings/actions";

const initial: ActionState = { ok: false };

export interface ConfigItem {
  id: string;
  label: string;
  active: boolean;
  meta?: string;
  /** Raw name to prefill the rename box (defaults to label). */
  editValue?: string;
}

/** One config row: shows name + meta, with inline rename and deactivate. */
function ConfigRow({ item, kind }: { item: ConfigItem; kind: ConfigKind }) {
  const [, toggle] = useActionState(setConfigActiveAction, initial);
  const [renameState, rename] = useActionState(setConfigNameAction, initial);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <form
          action={(fd) => { rename(fd); setEditing(false); }}
          className="flex items-center gap-1.5"
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          <input
            name="name"
            defaultValue={item.editValue ?? item.label}
            autoFocus
            required
            className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal"
          />
          <button className="rounded bg-teal px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-navy">✕</button>
        </form>
        {renameState.error ? <span className="text-xs text-port">{renameState.error}</span> : null}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <span className={item.active ? "text-slate-700" : "text-slate-400 line-through"}>
        {item.label}
        {item.meta ? <span className="ml-2 text-xs text-slate-400">{item.meta}</span> : null}
      </span>
      <span className="flex flex-none items-center gap-2">
        <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-navy">Edit</button>
        <form action={toggle}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="active" value={item.active ? "false" : "true"} />
          <button className="text-xs text-slate-400 hover:text-navy">{item.active ? "Deactivate" : "Reactivate"}</button>
        </form>
      </span>
    </li>
  );
}

export interface ExtraField {
  name: string;
  label: string;
  type: "text" | "checkbox" | "time" | "number";
  placeholder?: string;
}

/**
 * Reusable add/deactivate manager for one config list. Deactivate-never-delete:
 * inactive items are kept and shown dimmed with a reactivate control.
 */
export function ConfigManager({
  title,
  kind,
  items,
  extraFields = [],
}: {
  title: string;
  kind: ConfigKind;
  items: ConfigItem[];
  extraFields?: ExtraField[];
}) {
  const [addState, add, adding] = useActionState(addConfigAction, initial);

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <h3 className="mb-3 font-semibold text-navy">{title}</h3>

      <ul className="mb-4 space-y-1 text-sm">
        {items.length === 0 ? (
          <li className="text-slate-400">None configured</li>
        ) : (
          items.map((item) => <ConfigRow key={item.id} item={item} kind={kind} />)
        )}
      </ul>

      <form action={add} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="kind" value={kind} />
        <input
          name="name"
          placeholder="Name"
          required
          className="min-w-[8rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal"
        />
        {extraFields.map((f) =>
          f.type === "checkbox" ? (
            <label key={f.name} className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" name={f.name} defaultChecked={f.name === "countsTowardRatio"} />
              {f.label}
            </label>
          ) : (
            <input
              key={f.name}
              name={f.name}
              type={f.type === "time" ? "time" : f.type === "number" ? "number" : "text"}
              placeholder={f.placeholder ?? f.label}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal"
            />
          ),
        )}
        <button
          disabled={adding}
          className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
        {addState.error ? <span className="w-full text-xs text-port">{addState.error}</span> : null}
      </form>
    </div>
  );
}
