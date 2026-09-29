import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CookieNotice } from "@/components/marketing/CookieNotice";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex-none">
            <Logo variant="onLight" />
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600 sm:gap-5">
            <Link href="/#features" className="hidden hover:text-navy sm:inline">
              Features
            </Link>
            <Link href="/compare" className="hidden hover:text-navy sm:inline">
              Compare
            </Link>
            <Link href="/learn" className="hidden hover:text-navy sm:inline">
              Learn
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
          <nav className="mb-3 flex flex-wrap gap-x-5 gap-y-2 font-medium text-slate-600">
            <Link href="/pricing" className="hover:text-navy">Pricing</Link>
            <Link href="/compare" className="hover:text-navy">Compare</Link>
            <Link href="/learn" className="hover:text-navy">Learning Centre</Link>
            <Link href="/demo" className="hover:text-navy">Demo</Link>
            <Link href="/privacy" className="hover:text-navy">Privacy</Link>
            <Link href="/terms" className="hover:text-navy">Terms</Link>
            <Link href="/data-processing" className="hover:text-navy">Data processing</Link>
            <Link href="/cookies" className="hover:text-navy">Cookies</Link>
          </nav>
          <p>© {new Date().getFullYear()} ActivityRoster. EU-hosted. GDPR-ready.</p>
          <p className="mt-1">Built for RYA sailing &amp; watersports centres.</p>
        </div>
      </footer>
      <CookieNotice />
    </div>
  );
}
