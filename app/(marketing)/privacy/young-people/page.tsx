import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";
import { PRIVACY_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Your information if you are under 18 · ActivityRoster",
  description: "A plain-English explanation for young instructors, assistants and their parents of what ActivityRoster holds, who can see it and what you can ask for.",
};

/**
 * Compliance P1-G: the under-18 privacy page. Written for a 14-year-old assistant
 * and their parent, not for a lawyer. Keep it true to the code: the defaults it
 * describes live in lib/auth/rbac.ts, lib/services/guardians.ts,
 * lib/services/protected-contacts.ts, lib/services/retention.ts and the portal.
 */
export default function YoungPeoplePrivacyPage() {
  return (
    <LegalPage title="Your information if you are under 18" updated="4 October 2026">
      <P>If you help out or teach at a sailing or watersports centre that uses ActivityRoster, the centre keeps some information about you on it: your roster, your certificates and how to reach you. This page says, as plainly as we can, what that is, who can see it and what you and your parents can ask for. You do not need to read anything else to understand it.</P>

      <H2>Who is responsible for your information</H2>
      <P>Your centre is. ActivityRoster is the tool they use, the way a school might use a register app. We keep the information safe and only do with it what the centre asks. If you have a question about what your centre holds, ask whoever runs it or your centre&rsquo;s welfare officer first. If you have a question about ActivityRoster itself, email <a className="text-teal hover:underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</P>

      <H2>What is kept about you</H2>
      <UL items={[
        "Your name, date of birth and, if you have given them, your email address and mobile number.",
        "Which sessions you are on the roster for, your availability, hours worked and any leave.",
        "Your certificates (for example Assistant Instructor, first aid) and when they run out.",
        "An emergency contact and a parent or guardian contact, which only the centre's admin and welfare officer can open.",
        "Any messages you send through the app, such as a reason for not being able to do a shift.",
      ]} />
      <P>We do not keep anything about your school work, your health beyond what you or your parents choose to tell the centre for safety, or anything from social media.</P>

      <H2>Who can see what</H2>
      <UL items={[
        <>The <strong>people who run your centre</strong> (admins) can see everything above, because they roster you and have to look after you.</>,
        <>The <strong>welfare officer</strong> can see your profile and your emergency and guardian contacts, and nothing about pay or billing.</>,
        <>Your <strong>colleagues</strong> see your first name and which sessions you are on. They cannot see your phone number or email unless you switch on &ldquo;Let colleagues see my phone and email&rdquo; in your own settings. It is off until you choose otherwise.</>,
        <>Your <strong>parent or guardian</strong> can be given a read-only view of your roster: the dates, courses, times and places. Nothing else, and nobody else&rsquo;s details. The centre records that you were told.</>,
        <><strong>ActivityRoster staff</strong> do not browse centres&rsquo; data. A support view exists for fixing problems; every use of it is logged and visible to your centre.</>,
      ]} />

      <H2>Things we do differently because you are under 18</H2>
      <UL items={[
        "Your contact details are hidden from colleagues by default.",
        "Your centre can only roster you within the legal hours for your age. The app checks every shift against those rules and stops a breach.",
        "We never send you marketing, newsletters or offers, and we never build anything that profiles young people.",
        "Vetting checks are recorded by status and reference only; no certificate about you is stored as a file.",
        "When you leave the centre, your personal details are removed after the period your centre has set (12 months unless they chose otherwise); the roster history keeps only that someone did the shift.",
      ]} />

      <H2>What you can ask for</H2>
      <P>You, or your parent or guardian on your behalf, can ask your centre to show you everything it holds about you, to correct something, or to delete it (the centre may need to keep some records, such as who worked which shift, for a while). You can also ask us directly through the <Link href="/privacy-request" className="text-teal hover:underline">data request form</Link>. We reply within 30 days and we never charge for this.</P>

      <H2>If something feels wrong</H2>
      <P>If anyone at your centre contacts you in a way that makes you uncomfortable, or you think your information is being used wrongly, tell your centre&rsquo;s welfare officer or a trusted adult. You can also contact the <a className="text-teal hover:underline" href="https://ico.org.uk" rel="noreferrer">Information Commissioner&rsquo;s Office</a> in the UK or the <a className="text-teal hover:underline" href="https://www.dataprotection.ie" rel="noreferrer">Data Protection Commission</a> in Ireland. Our full <Link href="/privacy" className="text-teal hover:underline">privacy policy</Link> has the formal detail.</P>
    </LegalPage>
  );
}
