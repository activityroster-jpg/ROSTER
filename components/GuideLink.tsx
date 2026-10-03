/** "Read the guide" link into the Learning Centre, deep-linked to a section. Every feature page has one. */
export function GuideLink({ topic, label = "Read the guide", className = "" }: { topic: string; label?: string; className?: string }) {
  return (
    <a href={`/learn?topic=${topic}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline print:hidden ${className}`}>
      📖 {label}
    </a>
  );
}
