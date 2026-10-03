"use client";

import { passwordStrength } from "@/lib/security/password-strength";

const COLOURS = ["bg-slate-200", "bg-port", "bg-amber-400", "bg-teal", "bg-starboard"];

/** Four-segment strength bar with the rules that still need meeting. Guidance only; the server enforces the rule. */
export function PasswordStrength({ password, className = "" }: { password: string; className?: string }) {
  if (!password) return null;
  const s = passwordStrength(password);
  const todo = [
    !s.checks.length ? "at least 8 characters" : null,
    !s.checks.letter ? "a letter" : null,
    !s.checks.number ? "a number" : null,
  ].filter(Boolean) as string[];
  return (
    <div className={`text-xs ${className}`} aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= s.score ? COLOURS[s.score] : "bg-slate-200"}`} />)}
      </div>
      <p className={`mt-1 ${s.score <= 1 ? "text-port" : s.score === 2 ? "text-amber-700" : "text-starboard"}`}>
        {s.label}
        {todo.length ? <span className="text-slate-500"> · needs {todo.join(", ")}</span> : s.score < 3 ? <span className="text-slate-500"> · longer, or add capitals or symbols, to make it stronger</span> : null}
      </p>
    </div>
  );
}
