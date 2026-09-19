import Link from "next/link";
import { apexDomain } from "@/lib/config";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const apex = apexDomain();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-display text-xl font-bold text-navy">
            Activity<span className="text-teal">Roster</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/#features" className="hover:text-navy">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-navy">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-navy">
              FAQ
            </Link>
            <a
              href={`https://${apex}/pricing`}
              className="rounded-lg bg-navy px-4 py-2 text-white hover:bg-navy-700"
            >
              Get started
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
