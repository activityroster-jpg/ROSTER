import type { Metadata } from "next";
import { Fira_Sans } from "next/font/google";
import "./globals.css";

// Fira Sans is the RYA brand typeface — used for both UI and the wordmark for a
// cohesive, on-brand feel.
const fira = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivityRoster — compliance-aware rostering for RYA centres",
  description:
    "Staff rostering and course administration for RYA sailing, watersports schools, clubs and activity centres. It won't let a session run under-qualified, over-ratio, or without safety-boat cover.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fira.variable}>
      <body>{children}</body>
    </html>
  );
}
