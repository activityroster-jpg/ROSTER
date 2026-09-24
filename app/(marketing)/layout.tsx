import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex-none font-display text-xl font-bold text-navy">
            Activity<span className="text-teal">Roster</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600 sm:gap-5">
            <Link href="/#features" className="hidden hover:text-navy sm:inline">
              Features
            </Link>
            <Link href="/demo" className="hover:text-navy">
              Demo
            </Link>
            <Link href="/pricing" className="hover:text-navy">
              Pricing
            </Link>
            <a href="/#get-demo" className="flex-none whitespace-nowrap rounded-lg bg-navy px-3 py-2 text-white hover:bg-navy-700 sm:px-4">
              <span className="sm:hidden">Try free</span>
              <span className="hidden sm:inline">Try free for a month</span>
            </a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} ActivityRoster. EU-hosted. GDPR-ready.</p>
          <p className="mt-1">Built for RYA sailing &amp; watersports centres.</p>
        </div>
      </footer>
    </div>
  );
}
