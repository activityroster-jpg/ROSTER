import Link from "next/link";
import { CookieNotice } from "@/components/marketing/CookieNotice";
import { SiteHeader } from "@/components/marketing/SiteHeader";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          <nav className="mb-3 flex flex-wrap gap-x-5 gap-y-2 font-medium text-slate-600">
            <Link href="/pricing" className="hover:text-navy">Pricing</Link>
            <Link href="/compare" className="hover:text-navy">Compare</Link>
            <Link href="/learn" className="hover:text-navy">Learning Centre</Link>
            <Link href="/blog" className="hover:text-navy">Blog</Link>
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
