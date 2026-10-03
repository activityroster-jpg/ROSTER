"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { RotaRange } from "@/lib/rota/template";

/** Download the rota as a PDF for a chosen period, using the centre's saved layout. */
export function RotaDownload({ weekStart, defaultRange }: { weekStart: string; defaultRange: RotaRange }) {
  const [range, setRange] = useState<RotaRange>(defaultRange);
  const href = `/api/office/rota.pdf?range=${range}&from=${weekStart}`;
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-teal print:hidden">
      <select aria-label="Period" value={range} onChange={(e) => setRange(e.target.value as RotaRange)} className="h-9 border-0 bg-white px-2 text-sm text-navy outline-none">
        <option value="day">Monday only</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
      </select>
      <a href={href} className="inline-flex h-9 items-center gap-2 bg-teal px-3 text-sm font-semibold text-white hover:bg-teal-700">
        <FileDown className="h-4 w-4" /> Download PDF
      </a>
    </span>
  );
}
