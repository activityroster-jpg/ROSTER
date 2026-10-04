/**
 * ActivityRoster logo: a 3×3 rota grid mark + wordmark. Recreated as inline
 * SVG so it stays crisp at any size. `variant` picks colours for the background
 * it sits on (onDark = white/navy text on a dark bg; onLight = navy text on a
 * light bg). The accent blue square is constant in both.
 */
const CELLS = [
  [0, 0, "P"], [1, 0, "P"], [2, 0, "M"],
  [0, 1, "M"], [1, 1, "P"], [2, 1, "P"],
  [0, 2, "P"], [1, 2, "M"], [2, 2, "B"],
] as const;

export function Logo({
  variant = "onLight",
  size = "md",
  className = "",
}: {
  variant?: "onDark" | "onLight";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const c =
    variant === "onDark"
      ? { primary: "#FFFFFF", muted: "#5A6B82", blue: "#3F9FE0", text: "text-white" }
      : { primary: "#0A2E52", muted: "#C4CDD8", blue: "#3F9FE0", text: "text-navy" };

  const mark = { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-9 w-9" }[size];
  const type = { sm: "text-base", md: "text-xl", lg: "text-2xl" }[size];

  const pos = (i: number) => 6 + i * 32; // 6, 38, 70
  const fill = (t: string) => (t === "P" ? c.primary : t === "M" ? c.muted : c.blue);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 100 100" className={`${mark} flex-none`} role="img" aria-label="ActivityRoster">
        {CELLS.map(([col, row, t], i) => (
          <rect key={i} x={pos(col)} y={pos(row)} width={24} height={24} rx={6} fill={fill(t)} />
        ))}
      </svg>
      <span className={`font-display tracking-tight ${type} ${c.text}`}>
        <span className="font-semibold">Activity</span>
        <span className="font-extrabold">Rota</span>
      </span>
    </span>
  );
}
