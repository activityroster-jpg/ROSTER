"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / save as PDF", downloadName }: { label?: string; downloadName?: string }) {
  const print = () => {
    // The browser derives the "Save as PDF" filename from document.title at the
    // moment the dialog opens, so set it here (and restore it afterwards).
    if (downloadName) {
      const prev = document.title;
      document.title = downloadName;
      window.print();
      window.setTimeout(() => { document.title = prev; }, 1000);
    } else {
      window.print();
    }
  };
  return (
    <button
      onClick={print}
      className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 print:hidden"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
