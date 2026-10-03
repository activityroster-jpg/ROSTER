import Link from "next/link";
import { Calendar, Mail, MapPin, Rocket } from "lucide-react";
import { COMPANY } from "@/lib/config";

export const metadata = {
  title: "Contact us — ActivityRoster",
  description:
    "Get in touch with ActivityRoster — book a free 30-minute call, email us, start a free month, or find us on LinkedIn. Built for UK & Irish RYA sailing and watersports centres.",
  alternates: { canonical: "/contact" },
};

const GENERAL_EMAIL = "hello@activityroster.com";
const PRIVACY_EMAIL = "privacy@activityroster.com";
const LINKEDIN_URL = "https://www.linkedin.com/company/activity-roster";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Contact</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">Talk to us</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          A walkthrough, a quick question, or straight to a free month — pick whichever suits.
        </p>
      </div>

      {/* Primary: schedule a call */}
      <div className="mt-10 overflow-hidden rounded-card border border-teal shadow-lg">
        <div className="grid gap-0 md:grid-cols-[1.3fr_1fr]">
          <div className="p-7">
            <div className="flex items-center gap-2 text-teal">
              <Calendar className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-wide">Recommended</p>
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-navy">Schedule a call</h2>
            <p className="mt-2 text-slate-600">
              A free 30-minute walkthrough of rostering, certs and safety cover for your centre. Times are
              shown in <strong>GMT</strong>.
            </p>
          </div>
          <div className="flex flex-col justify-center border-t border-teal/30 bg-teal/5 p-7 text-center md:border-l md:border-t-0">
            <Link
              href="/book"
              className="block rounded-lg bg-teal px-6 py-3 text-center font-semibold text-white transition hover:bg-teal-700"
            >
              Schedule a call →
            </Link>
            <p className="mt-2 text-xs text-slate-500">30 minutes · online · free</p>
          </div>
        </div>
      </div>

      {/* Other ways to reach us */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {/* Email */}
        <div className="rounded-card border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-navy">
            <Mail className="h-5 w-5 text-teal" />
            <h2 className="font-semibold">Email us</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Questions, a demo or setup help — we reply within one working day.
          </p>
          <a href={`mailto:${GENERAL_EMAIL}`} className="mt-3 inline-block font-semibold text-teal hover:underline">
            {GENERAL_EMAIL}
          </a>
          <p className="mt-3 text-sm text-slate-600">
            Data protection &amp; privacy:{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-teal hover:underline">{PRIVACY_EMAIL}</a>
          </p>
        </div>

        {/* Start free */}
        <div className="rounded-card border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-navy">
            <Rocket className="h-5 w-5 text-teal" />
            <h2 className="font-semibold">Start a free month</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Dive straight in — no card required, and we&apos;re on hand if you need us.
          </p>
          <a href="/#get-demo" className="mt-3 inline-block font-semibold text-teal hover:underline">
            Start my free month →
          </a>
        </div>

        {/* LinkedIn */}
        <div className="rounded-card border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-navy">
            <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 text-teal" fill="currentColor">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
            <h2 className="font-semibold">LinkedIn</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">Follow along and message us on LinkedIn.</p>
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-teal hover:underline">
            ActivityRoster on LinkedIn →
          </a>
        </div>

        {/* Post */}
        <div className="rounded-card border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-navy">
            <MapPin className="h-5 w-5 text-teal" />
            <h2 className="font-semibold">By post</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">{COMPANY.legalName}</p>
          <address className="mt-1 text-sm not-italic text-slate-600">
            {COMPANY.addressLines.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </address>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-slate-500">
        Not sure where to start? <Link href="/book" className="font-semibold text-teal hover:underline">Schedule a call</Link>{" "}
        and we&apos;ll take it from there.
      </p>
    </div>
  );
}
