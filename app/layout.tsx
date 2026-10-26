import type { Metadata, Viewport } from "next";
import { Fira_Sans } from "next/font/google";
import { apexDomain } from "@/lib/config";
import { OG_IMAGE } from "@/lib/seo/og";
import "./globals.css";
import { ActionFailureWatcher } from "@/components/ActionFailureWatcher";

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
  "RYA sailing school software for Principals, Chief Instructors and centre managers: staff rostering checked against instructor types, ratios and supervision, instructor licences tracked, and an app for the team. For RYA training centres, sailing schools and clubs.";

/**
 * viewport-fit=cover lets the page run edge to edge on phones with rounded
 * corners and a home indicator; the app's header and bottom bar then pad
 * themselves with env(safe-area-inset-*) so nothing sits under the notch or the
 * indicator. Without it those values are zero in the app's web view.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0A2E52" };

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
    "sailing instructor scheduling software", "RYA qualification tracking software", "sailing centre management software",
    "watersports staff scheduling", "sailing club duty roster software", "RYA training centre software", "instructor rota software",
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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "ActivityRoster — RYA sailing school software",
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
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
        {/* Every surface (centres, Dev Center, main site): a save from a page left open across an update asks for a reload. */}
        <ActionFailureWatcher />
      </body>
    </html>
  );
}
