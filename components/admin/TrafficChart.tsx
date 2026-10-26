"use client";

import { useState } from "react";
import { CHANNELS, CHANNEL_META, type Channel } from "@/lib/analytics/channels";

export interface ChartDay { day: string; byChannel: Partial<Record<Channel, number>>; signups: number }
export interface ChartMarker { day: string; label: string }

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Daily visits by channel as stacked bars, with dated markers and trial
 * sign-ups on the same timeline underneath (one axis each: two charts, one
 * x-scale). Hover a day for its numbers.
 */
export function TrafficChart({ days, markers }: { days: ChartDay[]; markers: ChartMarker[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960, H = 260, PL = 36, PR = 8, PT = 10, PB = 22, SH = 46;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const totals = days.map((d) => CHANNELS.reduce((n, c) => n + (d.byChannel[c] ?? 0), 0));
  const max = Math.max(4, ...totals);
  const step = max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const top = Math.ceil(max / step) * step;
  const bw = plotW / days.length;
  const barW = Math.max(2, bw - 2);
  const y = (v: number) => PT + plotH - (v / top) * plotH;
  const x = (i: number) => PL + i * bw + (bw - barW) / 2;
  const sMax = Math.max(1, ...days.map((d) => d.signups));
  const idx = new Map(days.map((d, i) => [d.day, i]));
  const h = hover != null ? days[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + SH + 16}`} className="h-auto w-full" role="img" aria-label="Daily visits by channel for the last 60 days, with trial sign-ups per day underneath" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: top / step + 1 }, (_, k) => k * step).map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#64748b">{v}</text>
          </g>
        ))}
        {days.map((d, i) => {
          let acc = 0;
          return (
            <g key={d.day}>
              {CHANNELS.map((c) => {
                const n = d.byChannel[c] ?? 0;
                if (!n) return null;
                const y0 = y(acc), y1 = y(acc + n);
                acc += n;
                return <rect key={c} x={x(i)} y={y1 + 1} width={barW} height={Math.max(0, y0 - y1 - 1)} fill={CHANNEL_META[c].color} opacity={hover == null || hover === i ? 1 : 0.45} />;
              })}
              <rect x={PL + i * bw} y={PT} width={bw} height={plotH + SH + 20} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
        {markers.filter((m) => idx.has(m.day)).map((m, k) => {
          const mx = PL + idx.get(m.day)! * bw + bw / 2;
          return (
            <g key={`${m.day}-${k}`} pointerEvents="none">
              <line x1={mx} x2={mx} y1={PT} y2={H + SH} stroke="#0f172a" strokeWidth={1} strokeDasharray="3 3" />
              {/* Near the right edge the label sits to the left of its line, so it isn't cut off. */}
              <text x={mx > W - 140 ? mx - 4 : mx + 4} textAnchor={mx > W - 140 ? "end" : "start"} y={PT + 10 + (k % 2) * 13} fontSize={11} fill="#0f172a">{m.label}</text>
            </g>
          );
        })}
        {days.map((d, i) => (i % 7 === 0 || i === days.length - 1 ? <text key={d.day} x={PL + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#64748b">{fmtDay(d.day)}</text> : null))}
        {/* Trial sign-ups: the same days, their own scale */}
        <text x={PL - 6} y={H + 14} textAnchor="end" fontSize={11} fill="#64748b">Trials</text>
        <line x1={PL} x2={W - PR} y1={H + SH} y2={H + SH} stroke="#e2e8f0" />
        {days.map((d, i) => (d.signups ? (
          <g key={`s-${d.day}`} pointerEvents="none">
            <rect x={x(i)} y={H + SH - (d.signups / sMax) * (SH - 14)} width={barW} height={(d.signups / sMax) * (SH - 14)} rx={2} fill="#0f172a" />
            <text x={PL + i * bw + bw / 2} y={H + SH - (d.signups / sMax) * (SH - 14) - 3} textAnchor="middle" fontSize={10} fill="#0f172a">{d.signups}</text>
          </g>
        ) : null))}
      </svg>
      {h ? (
        <div className="pointer-events-none absolute right-2 top-2 w-52 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
          <p className="mb-1 font-semibold text-navy">{new Date(`${h.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</p>
          {CHANNELS.map((c) => (h.byChannel[c] ? (
            <p key={c} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: CHANNEL_META[c].color }} />{CHANNEL_META[c].label}</span><span className="tabular-nums text-navy">{h.byChannel[c]}</span></p>
          ) : null))}
          <p className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold text-navy"><span>Visits</span><span className="tabular-nums">{totals[hover!]}</span></p>
          <p className="flex justify-between text-slate-500"><span>Trial sign-ups</span><span className="tabular-nums">{h.signups}</span></p>
          {markers.filter((m) => m.day === h.day).map((m, k) => <p key={k} className="mt-1 text-slate-600">📍 {m.label}</p>)}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {CHANNELS.map((c) => <span key={c} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_META[c].color }} />{CHANNEL_META[c].label}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0f172a]" />Trial sign-ups (own scale)</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t border-dashed border-slate-900" />Marker</span>
      </div>
    </div>
  );
}
