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
          <div className="mb-3 flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/activity-roster"
              target="_blank"
              rel="noreferrer"
              aria-label="ActivityRoster on LinkedIn"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-navy hover:text-navy"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
              LinkedIn
            </a>
          </div>
          <p>© {new Date().getFullYear()} ActiveRoster Ltd. EU-hosted. GDPR-ready.</p>
          <p className="mt-1">ActivityRoster is a product of ActiveRoster Ltd, a company registered in England &amp; Wales. Registered office: 71-75 Shelton Street, London WC2H 9JQ.</p>
          <p className="mt-1">Built for RYA sailing &amp; watersports centres.</p>
        </div>
      </footer>
      <CookieNotice />
    </div>
  );
}
