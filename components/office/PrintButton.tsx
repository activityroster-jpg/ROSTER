"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 print:hidden"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
