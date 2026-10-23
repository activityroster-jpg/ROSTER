"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";

/** Primary nav shown on desktop — kept short so the header stays uncluttered. */
const PRIMARY = [
  { href: "/pricing", label: "Pricing" },
  { href: "/learn", label: "Learn" },
  { href: "/contact", label: "Contact" },
];

/** The full set, shown in the mobile menu (secondary pages too). */
const ALL = [
  { href: "/start", label: "Start my free month" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/learn", label: "Learning Centre" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/" className="flex-none" aria-label="ActivityRoster home">
          <Logo variant="onLight" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {PRIMARY.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-navy">
              {l.label}
            </Link>
          ))}
          <Link href="/start" className="rounded-lg bg-navy px-4 py-2 text-white transition hover:bg-navy-700">
            Try free for a month
          </Link>
          <Link href="/sign-in" className="rounded-lg border border-slate-300 px-3.5 py-2 text-navy transition hover:bg-slate-50">
            Sign in
          </Link>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          {/* One button on phones: the page itself carries the sign-up box, and the menu has the rest. */}
          <Link href="/sign-in" className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-navy">
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {open ? (
        <nav className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-2">
            {[...ALL, { href: "/sign-in", label: "Sign in" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
