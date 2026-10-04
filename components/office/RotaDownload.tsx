"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { RotaRange } from "@/lib/rota/template";

/**
 * Download the roster as a PDF for a chosen period, using the centre's saved
 * layout. "One day" means today when today falls in the week on screen,
 * otherwise the Monday of that week, and the label says which.
 */
export function RotaDownload({ weekStart, today, defaultRange }: { weekStart: string; today: string; defaultRange: RotaRange }) {
  const [range, setRange] = useState<RotaRange>(defaultRange);
  const weekEnd = new Date(`${weekStart}T00:00:00Z`); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const inWeek = today >= weekStart && today <= weekEnd.toISOString().slice(0, 10);
  const dayFrom = inWeek ? today : weekStart;
  const dayLabel = inWeek ? "Today" : `Monday ${new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  const href = `/api/office/rota.pdf?range=${range}&from=${range === "day" ? dayFrom : weekStart}`;
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-teal print:hidden">
      <select aria-label="Period to download" value={range} onChange={(e) => setRange(e.target.value as RotaRange)} className="h-9 border-0 bg-white px-2 text-sm text-navy outline-none">
        <option value="day">{dayLabel}</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
      </select>
      <a href={href} className="inline-flex h-9 items-center gap-2 bg-teal px-3 text-sm font-semibold text-white hover:bg-teal-700">
        <FileDown className="h-4 w-4" /> Download PDF
      </a>
    </span>
  );
}
