import Link from "next/link";
import { COMPANY } from "@/lib/config";
import { LANDINGS } from "@/lib/seo/landings";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { IncidentBanner } from "@/components/IncidentBanner";
import { HelpAssistant } from "@/components/HelpAssistant";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <IncidentBanner />
      <SiteHeader />
      <main id="main">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
          <nav aria-label="Software for RYA centres" className="mb-5 border-b border-slate-100 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Software for RYA centres</p>
            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {LANDINGS.map((l) => <Link key={l.slug} href={`/${l.slug}`} className="inline-block py-1.5 hover:text-navy">{l.navLabel}</Link>)}
              <Link href="/guides" className="inline-block py-1.5 font-medium text-slate-600 hover:text-navy">Sailing school guides</Link>
            </div>
          </nav>
          <nav className="mb-3 flex flex-wrap gap-x-5 gap-y-1 font-medium text-slate-600">
            <Link href="/features" className="inline-block py-1.5 hover:text-navy">Features</Link>
            <Link href="/pricing" className="inline-block py-1.5 hover:text-navy">Pricing</Link>
            <Link href="/compare" className="inline-block py-1.5 hover:text-navy">Compare</Link>
            <Link href="/learn" className="inline-block py-1.5 hover:text-navy">Learning Centre</Link>
            <Link href="/blog" className="inline-block py-1.5 hover:text-navy">Blog</Link>
            <Link href="/demo" className="hidden py-1.5 hover:text-navy md:inline-block">Demo</Link>
            <Link href="/contact" className="inline-block py-1.5 hover:text-navy">Contact</Link>
            <Link href="/sign-in" className="inline-block py-1.5 hover:text-navy">Sign in</Link>
            <Link href="/privacy" className="inline-block py-1.5 hover:text-navy">Privacy</Link>
            <Link href="/terms" className="inline-block py-1.5 hover:text-navy">Terms</Link>
            <Link href="/data-processing" className="inline-block py-1.5 hover:text-navy">Data processing</Link>
            <Link href="/trust" className="inline-block py-1.5 hover:text-navy">Security</Link>
            <Link href="/privacy-request" className="inline-block py-1.5 hover:text-navy">Data requests</Link>
            <Link href="/privacy/young-people" className="inline-block py-1.5 hover:text-navy">Under-18s</Link>
            <Link href="/subprocessors" className="inline-block py-1.5 hover:text-navy">Sub-processors</Link>
            <Link href="/accessibility" className="inline-block py-1.5 hover:text-navy">Accessibility</Link>
            <Link href="/cookies" className="inline-block py-1.5 hover:text-navy">Cookies</Link>
            <Link href="/diving" className="inline-block py-1.5 hover:text-navy">Dive centres</Link>
          </nav>
          <div className="mb-3 flex items-center gap-3">
            <a
              href={COMPANY.social.linkedin}
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
            <a
              href={COMPANY.social.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="ActivityRoster on Facebook"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-navy hover:text-navy"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
              </svg>
              Facebook
            </a>
          </div>
          <p className="mb-3 text-xs text-slate-500">Only the cookies needed to sign you in; no tracking, no ads. <Link href="/cookies" className="inline-block py-1.5 font-medium text-slate-600 underline hover:text-navy">Cookie notice</Link></p>
          <p>© {new Date().getFullYear()} ActiveRoster Ltd · Built for UK &amp; Irish RYA centres · Hosted in the EU · UK GDPR-ready.</p>
          <p className="mt-1">{COMPANY.legalName} is registered in England &amp; Wales, company number {COMPANY.companyNumber}. Registered office: {COMPANY.addressInline}.</p>
        </div>
      </footer>
      <HelpAssistant surface="site" />
    </div>
  );
}
