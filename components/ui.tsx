import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "covered" | "conflict" | "attention" | "neutral";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    covered: "bg-[#1E8E5A]/10 text-[#1E8E5A]",
    conflict: "bg-[#C43D3D]/10 text-[#C43D3D]",
    attention: "bg-[#B9821A]/10 text-[#B9821A]",
    neutral: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="mb-6">
      {eyebrow ? <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal">{eyebrow}</p> : null}
      <h2 className="font-display text-2xl font-semibold text-navy">{title}</h2>
    </div>
  );
}
