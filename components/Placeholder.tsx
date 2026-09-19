import { Card } from "@/components/ui";

export function Placeholder({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-navy">{title}</h1>
      <Card>
        <p className="text-sm text-slate-600">{children ?? "This screen is part of a later build phase."}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-teal">{phase}</p>
      </Card>
    </div>
  );
}
