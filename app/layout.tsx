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
  "Staff rostering and course administration for RYA sailing, watersports schools, clubs and activity centres. It won't let a session run under-qualified, over-ratio, or without safety-boat cover.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "ActivityRoster — compliance-aware rostering for RYA centres",
    template: "%s | ActivityRoster",
  },
  description: DESCRIPTION,
  applicationName: "ActivityRoster",
  keywords: [
    "RYA rostering", "sailing school software", "watersports centre management",
    "instructor scheduling", "safety boat cover", "RYA training centre", "sailing club software",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "ActivityRoster",
    title: "ActivityRoster — compliance-aware rostering for RYA centres",
    description: DESCRIPTION,
    url: SITE,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "ActivityRoster — rostering for RYA centres",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fira.variable}>
      <body>{children}</body>
    </html>
  );
}
