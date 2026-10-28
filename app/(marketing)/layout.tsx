import Link from "next/link";
import { COMPANY } from "@/lib/config";
import { LANDINGS } from "@/lib/seo/landings";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { IncidentBanner } from "@/components/IncidentBanner";
import { HelpAssistant } from "@/components/HelpAssistant";
import { PageViewBeacon } from "@/components/marketing/PageViewBeacon";

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
            <Link href="/instructors" className="inline-block py-1.5 hover:text-navy">Instructor app</Link>
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
          <p className="mb-3 text-xs text-slate-500">Only the cookies needed to sign you in; no tracking, no ads. <Link href="/cookies" className="inline-block py-1.5 font-medium text-slate-600 underline hover:text-navy">Cookie notice</Link></p>
          <p>© {new Date().getFullYear()} ActiveRoster Ltd · Built for UK &amp; Irish RYA centres · Hosted in the EU · UK GDPR-ready.</p>
          <p className="mt-1">{COMPANY.legalName} is registered in England &amp; Wales, company number {COMPANY.companyNumber}. Registered office: {COMPANY.addressInline}.</p>
        </div>
      </footer>
      <HelpAssistant surface="site" />
      <PageViewBeacon />
    </div>
  );
}
