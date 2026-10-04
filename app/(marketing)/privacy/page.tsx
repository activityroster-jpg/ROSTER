import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const metadata = { title: "Privacy Policy · ActivityRoster" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 October 2026">
      <P>This policy explains what personal data ActivityRoster (&ldquo;we&rdquo;) processes, why, and your rights under the UK GDPR and the EU GDPR. It covers the ActivityRoster website and the rostering platform used by sailing &amp; watersports centres.</P>

      <H2>Who is the data controller</H2>
      <P>ActivityRoster is a product of <strong>ActiveRoster Ltd</strong>, registered in England &amp; Wales, 71-75 Shelton Street, London WC2H 9JQ, United Kingdom. For personal data you give us as a customer or visitor (your account, billing, enquiries), ActiveRoster Ltd is the data controller. For data a centre stores about its own staff and operations inside the platform, the centre is the controller and ActiveRoster Ltd is the processor acting on the centre&apos;s instructions (see our Data Processing terms).</P>

      <H2>What we collect</H2>
      <UL items={[
        "Account details: name, email, and a hashed password / login PIN.",
        "Centre details: centre name, subdomain, region and jurisdiction.",
        "Staff records entered by a centre: instructor names, contact details, certs (qualifications), DBS/vetting and other compliance records, availability, hours and leave.",
        "Billing data: we store only Stripe identifiers and invoice metadata — never card numbers (Stripe handles card data).",
        "Usage & technical data: log data, IP address and cookies strictly needed to run the service.",
      ]} />

      <H2>Why we process it (lawful bases)</H2>
      <UL items={[
        "To provide the service you signed up for (performance of a contract).",
        "To keep the platform secure and prevent abuse (legitimate interests).",
        "To take payment and meet tax/accounting duties (legal obligation).",
        "To send service and, where you have agreed, marketing emails (consent / legitimate interests).",
      ]} />

      <H2>Where your data lives</H2>
      <P>Platform data is stored in the EU (Cloudflare D1 and R2, EU jurisdiction). Payments are processed by Stripe and email by Resend, who may process limited data under their own safeguards. We pin data residency to the EU/UK for GDPR.</P>

      <H2>How long we keep it</H2>
      <P>We keep account and centre data for as long as the centre is active, and for a limited retention window afterwards so a centre can export its data before deletion. Billing records are kept as long as the law requires. You can request earlier deletion (see below).</P>

      <H2>Sharing</H2>
      <P>We do not sell personal data. We share it only with the sub-processors needed to run the service (hosting, payments, email) and where legally required. The current list, with every change dated, is at <a className="text-teal hover:underline" href="/subprocessors">activityroster.com/subprocessors</a>; centres are told before a new one is added.</P>

      <H2>Under-18s</H2>
      <P>Some instructors and assistants are under 18. They get higher-privacy defaults, their parents or guardians can be given a read-only view of their roster, and nothing we build markets to them. The plain-English version for young people and their families is at <a className="text-teal hover:underline" href="/privacy/young-people">activityroster.com/privacy/young-people</a>.</P>

      <H2>Your rights</H2>
      <P>You have the right to access, correct, delete, restrict or object to processing, and to data portability. Centres can export their data at any time from Settings. To exercise a right, email <a className="text-teal hover:underline" href="mailto:privacy@activityroster.com">privacy@activityroster.com</a>. You may also complain to the UK Information Commissioner&apos;s Office (ICO) or your local supervisory authority.</P>

      <H2>Security</H2>
      <P>Passwords and PINs are stored only as salted hashes; documents are held in a private, per-centre file store; each centre&apos;s data is strictly isolated; and access is authorised on every request. We use TLS in transit and apply security headers and rate limiting.</P>

      <H2>Contact</H2>
      <P>Questions about this policy: <a className="text-teal hover:underline" href="mailto:privacy@activityroster.com">privacy@activityroster.com</a>. Or write to us at ActiveRoster Ltd, 71-75 Shelton Street, London WC2H 9JQ, United Kingdom.</P>
    </LegalPage>
  );
}
