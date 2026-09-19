import type { Metadata } from "next";
import { IBM_Plex_Sans, Spectral } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivityRoster — compliance-aware rostering for RYA centres",
  description:
    "Staff rostering and course administration for RYA sailing, watersports schools, clubs and activity centres. It won't let a session run under-qualified, over-ratio, or without safety-boat cover.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${spectral.variable}`}>
      <body>{children}</body>
    </html>
  );
}
