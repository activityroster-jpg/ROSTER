import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const metadata = { title: "Cookie Notice · ActivityRoster" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Notice" updated="29 September 2026">
      <P>ActivityRoster uses only the cookies and local storage strictly necessary to run the service. We do not use advertising or third-party tracking cookies.</P>

      <H2>What we use</H2>
      <UL items={[
        "Session cookie — keeps you signed in across your centre's pages (essential).",
        "PIN-verification cookie — remembers that you've entered your login PIN for the current session (essential, signed, HttpOnly).",
        "Local storage — small conveniences such as a remembered tab or a dismissed banner (optional; stays in your browser).",
      ]} />

      <H2>Why no banner-consent for these</H2>
      <P>Strictly necessary cookies (sign-in and security) don&apos;t require consent under PECR/GDPR because the service can&apos;t function without them. We show a short notice so you know they&apos;re used. We&apos;ll ask for consent before ever adding any non-essential/analytics cookies.</P>

      <H2>Managing cookies</H2>
      <P>You can clear or block cookies in your browser settings, but the platform won&apos;t work signed-out without the session cookie.</P>

      <H2>Contact</H2>
      <P><a className="text-teal hover:underline" href="mailto:privacy@activityroster.com">privacy@activityroster.com</a></P>
    </LegalPage>
  );
}
