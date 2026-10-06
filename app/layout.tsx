import type { Metadata } from "next";
import { Fira_Sans } from "next/font/google";
import { apexDomain } from "@/lib/config";
import "./globals.css";

const SITE = `https://${apexDomain()}`;

// Fira Sans is the RYA brand typeface — used for both UI and the wordmark for a
// cohesive, on-brand feel.
const fira = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const DESCRIPTION =
  "RYA sailing school software: staff rostering, instructor qualifications, availability and safety-boat cover checked as you schedule, with an app for your instructors. For RYA sailing schools, clubs and watersports centres.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "ActivityRoster — RYA sailing school software",
    template: "%s | ActivityRoster",
  },
  description: DESCRIPTION,
  applicationName: "ActivityRoster",
  keywords: [
    "RYA sailing school software", "RYA staff rostering software", "sailing school rostering software",
    "sailing instructor scheduling software", "RYA qualification tracking", "sailing centre management software",
    "watersports staff scheduling", "safety boat cover", "RYA training centre",
  ],
  // No site-wide canonical: each page sets its own. (A canonical of "/" here
  // told search engines every page was a copy of the homepage; fixed 6 Oct.)
  openGraph: {
    type: "website",
    siteName: "ActivityRoster",
    title: "ActivityRoster — RYA sailing school software",
    description: DESCRIPTION,
    url: SITE,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "ActivityRoster — RYA sailing school software",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Google Search Console ownership verification (meta-tag method). Set
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token Search Console gives you
  // and it renders <meta name="google-site-verification" ...> site-wide.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fira.variable}>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
