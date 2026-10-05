export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
      <p className="mt-1 text-sm text-slate-400">Last updated {updated}</p>
      <div className="legal mt-8 space-y-5 text-sm leading-relaxed text-slate-700">{children}</div>
      <p className="mt-10 rounded-lg bg-canvas p-4 text-xs text-slate-500">
        This page is a plain-English summary provided for transparency and is not legal advice. Have your final
        documents reviewed by a solicitor before relying on them commercially.
      </p>
    </div>
  );
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="scroll-mt-24 pt-3 font-display text-lg font-semibold text-navy">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}
