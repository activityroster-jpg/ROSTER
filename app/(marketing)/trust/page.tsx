import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_CONTACT, SECURITY_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Security and privacy",
  description: "How ActivityRoster keeps centres' data safe: EU hosting, tenant isolation, encryption, sign-in protections, backups, and how to report a vulnerability.",
};

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 font-display text-xl font-semibold text-navy">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-slate-600">{children}</p>;

export default function SecurityPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-3xl font-bold text-navy">Security and privacy</h1>
      <P>ActivityRoster holds rosters, qualifications and contact details for the people who run and teach at sailing centres, including some under-18 instructors. This page says plainly what we do to protect that, in the order most centres ask.</P>

      <H>Where your data lives</H>
      <P>Everything is hosted on Cloudflare in Western Europe: the database, uploaded documents and the application itself. Uploaded files sit in storage pinned to the EU jurisdiction. The few other companies that touch data (email delivery, card payments, error monitoring) are listed in our data-processing terms, each under a signed data-processing agreement.</P>

      <H>One centre can never see another</H>
      <P>Every record carries the centre it belongs to, and every read and write goes through one data-access layer that enforces that. An automated test creates two centres and proves one cannot read, list, change or export the other&rsquo;s records; it runs before every deployment.</P>

      <H>Signing in</H>
      <P>Passwords are at least 8 characters with letters and numbers, checked against known breached-password lists, and stored only as salted slow hashes. Office users sign in with email and password, then confirm a code we email the first time on a device and after 12 hours away; the email alone tells us which centre you belong to, and if you belong to several you choose. Everyone sets a 4-digit PIN that is asked for after a period without activity (30 minutes unless the centre changes it, between 5 minutes and 4 hours). Optional two-factor authentication with an authenticator app is available, and the platform&rsquo;s own owner area requires it. New devices and countries trigger an extra check and an email. Sign-ins are rate-limited and repeated failures lock the account briefly and alert the owner. You can sign out of every device from Settings.</P>

      <H>Encryption and hardening</H>
      <P>All traffic is HTTPS with HSTS. Database queries are parameterised. Every input is validated on the server. Security headers (Content-Security-Policy, frame-ancestors none, nosniff, referrer and permissions policies) are set on every response. Card details never touch our systems: payments run through Stripe Checkout.</P>

      <H>Who sees what</H>
      <P>Five roles, chosen by the centre: admin, senior instructor (the roster but no pay, billing or exports), welfare officer (people and their emergency contacts, nothing operational or financial), instructor (their own shifts, hours and leave, and colleagues&rsquo; names and shift times) and parent or guardian (a read-only roster for their own under-18). Contact details are hidden from colleagues until the person switches sharing on; for under-18s it is off by default. Vetting checks are recorded by status and reference only; no certificate file is stored. Every change to the roster, staff, settings and billing is written to a change log that cannot be edited or deleted, and the same is true of the security log.</P>

      <H>Keeping only what is needed</H>
      <P>Each centre sets how long it keeps each kind of record (12 months for people who have left unless it chooses otherwise) and gets 14 days&rsquo; notice before anything is removed, with a one-click &ldquo;keep&rdquo;. Anyone can be given a copy of everything held about them, have their record restricted while a question is settled, or be anonymised, from their profile. Young workers&rsquo; hours are checked against the legal limits for their age on every shift; adults get a warning when a week looks over the working-time limits.</P>

      <H>Backups and resilience</H>
      <P>The database keeps point-in-time history for 30 days, with nightly encrypted exports kept in the EU and a second copy outside Cloudflare. Restores are tested each quarter. The platform is watched from outside Cloudflare around the clock; live status and any incidents are on our <a href="https://activity-roster.betteruptime.com" className="font-semibold text-teal hover:underline" rel="noreferrer">status page</a>. If the platform is ever down, centres can still print the day&rsquo;s roster and emergency sheet in advance, or have the day&rsquo;s roster emailed each morning.</P>

      <H>Your rights and complaints</H>
      <P>Anyone can ask for, correct or delete their data, or complain, through our <Link href="/privacy-request" className="font-semibold text-teal hover:underline">data request form</Link> or by emailing {PRIVACY_CONTACT}. We acknowledge within 30 days. Centres can export all their data at any time from Settings.</P>

      <H>Reporting a security problem</H>
      <P>If you believe you have found a vulnerability, email <a href={`mailto:${SECURITY_CONTACT}`} className="font-semibold text-teal hover:underline">{SECURITY_CONTACT}</a> with enough detail to reproduce it. Please don&rsquo;t access other people&rsquo;s data, degrade the service or keep anything you come across. We&rsquo;ll acknowledge within three working days, keep you informed, fix confirmed issues promptly and, with your permission, credit you. We will not take legal action against good-faith research that follows these rules. Our machine-readable policy is at <code className="text-xs">/.well-known/security.txt</code>.</P>

      <p className="mt-10 text-sm text-slate-400">See also: <Link href="/privacy" className="hover:text-navy">Privacy</Link> · <Link href="/data-processing" className="hover:text-navy">Data processing</Link> · <Link href="/terms" className="hover:text-navy">Terms</Link>. <Link href="/subprocessors" className="hover:text-navy">Sub-processors</Link> · <Link href="/accessibility" className="hover:text-navy">Accessibility</Link> · <Link href="/privacy/young-people" className="hover:text-navy">Under-18s</Link>. Last reviewed 4 October 2026.</p>
    </section>
  );
}
