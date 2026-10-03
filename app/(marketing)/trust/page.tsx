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
      <P>ActivityRoster holds rotas, qualifications and contact details for the people who run and teach at sailing centres, including some under-18 instructors. This page says plainly what we do to protect that, in the order most centres ask.</P>

      <H>Where your data lives</H>
      <P>Everything is hosted on Cloudflare in Western Europe: the database, uploaded documents and the application itself. Uploaded files sit in storage pinned to the EU jurisdiction. The few other companies that touch data (email delivery, card payments, error monitoring) are listed in our data-processing terms, each under a signed data-processing agreement.</P>

      <H>One centre can never see another</H>
      <P>Every record carries the centre it belongs to, and every read and write goes through one data-access layer that enforces that. An automated test creates two centres and proves one cannot read, list, change or export the other&rsquo;s records; it runs before every deployment.</P>

      <H>Signing in</H>
      <P>Passwords are at least 12 characters, checked against known breached-password lists, and stored only as salted slow hashes. Centre admins sign in with email and password, then confirm a code we email the first time on a device and after 12 hours away. Everyone sets a 4-digit PIN that is asked for after 30 minutes without activity. Optional two-factor authentication with an authenticator app is available. New devices and countries trigger an extra check and an email. Sign-ins are rate-limited.</P>

      <H>Encryption and hardening</H>
      <P>All traffic is HTTPS with HSTS. Database queries are parameterised. Every input is validated on the server. Security headers (Content-Security-Policy, frame-ancestors none, nosniff, referrer and permissions policies) are set on every response. Card details never touch our systems: payments run through Stripe Checkout.</P>

      <H>Who sees what</H>
      <P>Instructors see their own shifts, hours and leave, and their colleagues&rsquo; names and shift times. Contact details, pay rates, documents and exports are for centre admins. Every change to the roster, staff, settings and billing is written to a change log the centre can read.</P>

      <H>Backups and resilience</H>
      <P>The database keeps point-in-time history for 30 days, with nightly encrypted exports kept in the EU and a second copy outside Cloudflare. Restores are tested each quarter. If the platform is ever down, centres can still print the day&rsquo;s rota in advance.</P>

      <H>Your rights and complaints</H>
      <P>Anyone can ask for, correct or delete their data, or complain, through our <Link href="/privacy-request" className="font-semibold text-teal hover:underline">data request form</Link> or by emailing {PRIVACY_CONTACT}. We acknowledge within 30 days. Centres can export all their data at any time from Settings.</P>

      <H>Reporting a security problem</H>
      <P>If you believe you have found a vulnerability, email <a href={`mailto:${SECURITY_CONTACT}`} className="font-semibold text-teal hover:underline">{SECURITY_CONTACT}</a> with enough detail to reproduce it. Please don&rsquo;t access other people&rsquo;s data, degrade the service or keep anything you come across. We&rsquo;ll acknowledge within three working days, keep you informed, fix confirmed issues promptly and, with your permission, credit you. We will not take legal action against good-faith research that follows these rules. Our machine-readable policy is at <code className="text-xs">/.well-known/security.txt</code>.</P>

      <p className="mt-10 text-sm text-slate-400">See also: <Link href="/privacy" className="hover:text-navy">Privacy</Link> · <Link href="/data-processing" className="hover:text-navy">Data processing</Link> · <Link href="/terms" className="hover:text-navy">Terms</Link>. Last reviewed 3 October 2026.</p>
    </section>
  );
}
