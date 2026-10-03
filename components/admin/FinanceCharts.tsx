"use client";

import { useState } from "react";

const SERIES = { revenue: "#0072CE", expenses: "#eb6834" } as const; // validated pair (CVD ΔE 25+)
const fmt = (minor: number, cur: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(minor / 100);

export interface MonthBar { label: string; revenueMinor: number; expensesMinor: number; cumulativeMinor: number }

/** Revenue vs expenses by month, plus the running net — one axis, direct labels on hover. */
export function MonthlyChart({ months, currency }: { months: MonthBar[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, L = 56, R = 12, T = 16, B = 34;
  const max = Math.max(1, ...months.flatMap((m) => [m.revenueMinor, m.expensesMinor]));
  const bw = (W - L - R) / months.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = 4;
  return (
    <figure>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.revenue }} />Revenue</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.expenses }} />Expenses</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue and expenses by month">
        {Array.from({ length: ticks + 1 }, (_, i) => { const v = (max / ticks) * i; return (
          <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#64748b">{fmt(v, currency)}</text></g>
        ); })}
        {months.map((m, i) => {
          const x0 = L + i * bw + bw * 0.15, w = bw * 0.32;
          const hr = y(0) - y(m.revenueMinor), he = y(0) - y(m.expensesMinor);
          return (
            <g key={m.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
              <rect x={x0} y={y(m.revenueMinor)} width={w} height={Math.max(0, hr)} rx={hr > 4 ? 3 : 0} fill={SERIES.revenue} opacity={hover === null || hover === i ? 1 : 0.45} />
              <rect x={x0 + w + 2} y={y(m.expensesMinor)} width={w} height={Math.max(0, he)} rx={he > 4 ? 3 : 0} fill={SERIES.expenses} opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={L + i * bw + bw / 2} y={H - B + 14} textAnchor="middle" fontSize={11} fill="#475569">{m.label}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} />
        {hover !== null ? (() => { const m = months[hover]!; const cx = Math.min(W - 150, Math.max(L, L + hover * bw)); return (
          <g pointerEvents="none">
            <rect x={cx} y={T} width={146} height={54} rx={6} fill="#0A2E52" />
            <text x={cx + 8} y={T + 16} fontSize={11} fill="#fff" fontWeight={600}>{m.label}</text>
            <text x={cx + 8} y={T + 30} fontSize={11} fill="#fff">Revenue {fmt(m.revenueMinor, currency)}</text>
            <text x={cx + 8} y={T + 44} fontSize={11} fill="#fff">Expenses {fmt(m.expensesMinor, currency)} · net {fmt(m.revenueMinor - m.expensesMinor, currency)}</text>
          </g>
        ); })() : null}
      </svg>
    </figure>
  );
}

/** Where the money went: horizontal bars, one hue, largest first. */
export function BreakdownChart({ items, currency }: { items: { label: string; amountMinor: number }[]; currency: string }) {
  const top = items.slice(0, 12);
  const max = Math.max(1, ...top.map((i) => i.amountMinor));
  if (top.length === 0) return <p className="text-sm text-slate-400">No expenses recorded for this year yet.</p>;
  return (
    <ul className="space-y-1.5" aria-label="Expenses by category">
      {top.map((i) => (
        <li key={i.label} className="grid grid-cols-[11rem_1fr_6rem] items-center gap-2 text-xs">
          <span className="truncate text-slate-600" title={i.label}>{i.label}</span>
          <span className="h-3 overflow-hidden rounded-sm bg-slate-100"><span className="block h-full rounded-sm" style={{ width: `${Math.max(1, (i.amountMinor / max) * 100)}%`, background: "#eb6834" }} /></span>
          <span className="text-right font-medium text-navy">{fmt(i.amountMinor, currency)}</span>
        </li>
      ))}
      {items.length > 12 ? <li className="text-[11px] text-slate-400">+ {items.length - 12} smaller categories in the P&L below</li> : null}
    </ul>
  );
}

/** Running profit across the year. */
export function CumulativeChart({ months, currency }: { months: MonthBar[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 180, L = 56, R = 12, T = 14, B = 30;
  const vals = months.map((m) => m.cumulativeMinor);
  const max = Math.max(1, ...vals, 0), min = Math.min(0, ...vals);
  const x = (i: number) => L + (i / Math.max(1, months.length - 1)) * (W - L - R);
  const y = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const d = vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const last = vals[vals.length - 1] ?? 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative profit across the year">
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} />
      <text x={L - 6} y={y(0) + 3} textAnchor="end" fontSize={10} fill="#64748b">0</text>
      <path d={d} fill="none" stroke={last >= 0 ? "#0072CE" : "#eb6834"} strokeWidth={2} strokeLinejoin="round" />
      {months.map((m, i) => (
        <g key={m.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <rect x={x(i) - 15} y={T} width={30} height={H - T - B} fill="transparent" />
          <circle cx={x(i)} cy={y(m.cumulativeMinor)} r={hover === i ? 5 : 3.5} fill="#fff" stroke={last >= 0 ? "#0072CE" : "#eb6834"} strokeWidth={2} />
          <text x={x(i)} y={H - B + 14} textAnchor="middle" fontSize={11} fill="#475569">{m.label}</text>
        </g>
      ))}
      <text x={x(months.length - 1)} y={y(last) - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="#0A2E52">{fmt(last, currency)}</text>
      {hover !== null ? <text x={x(hover)} y={y(months[hover]!.cumulativeMinor) - 10} textAnchor="middle" fontSize={11} fill="#0A2E52">{fmt(months[hover]!.cumulativeMinor, currency)}</text> : null}
    </svg>
  );
}
