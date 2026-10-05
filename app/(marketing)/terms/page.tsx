import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";
import { getDb } from "@/lib/cf/bindings";
import { fairUseSettings } from "@/lib/services/fair-use";
import { DEFAULT_PRICING } from "@/lib/pricing";

export const metadata = { title: "Terms of Service · ActivityRoster" };
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  let fairUse: { fairUsePeople: number; inviteDailyCap: number } = DEFAULT_PRICING;
  try { fairUse = await fairUseSettings(await getDb()); } catch { /* defaults */ }
  return (
    <LegalPage title="Terms of Service" updated="5 October 2026">
      <P>These terms govern your use of ActivityRoster, a product operated by <strong>ActiveRoster Ltd</strong>, a company registered in England &amp; Wales with its registered office at 71-75 Shelton Street, London WC2H 9JQ, United Kingdom (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the service, you agree to them.</P>

      <H2>The service</H2>
      <P>ActivityRoster is a subscription tool for staff rostering, compliance tracking and course administration for sailing &amp; watersports centres. We may improve or change features over time; we won&apos;t materially reduce the core service you pay for without notice.</P>

      <H2>Accounts &amp; your responsibilities</H2>
      <UL items={[
        "Keep your login, password and PIN secure and don't share them.",
        "You're responsible for what your centre's admins and staff do in your account.",
        "You must have the right to store the staff and compliance data you enter, and to keep it accurate.",
        "Don't misuse the service, attempt to breach security, or use it unlawfully.",
        "Only invite people who work or volunteer at your centre, and don't use invitations or notifications to contact anyone else.",
      ]} />

      <H2>Free trial &amp; billing</H2>
      <UL items={[
        "New centres start with a free trial — no card required.",
        "To continue after the trial, you subscribe monthly or annually. Prices are shown at checkout and may include VAT.",
        "Subscriptions renew automatically until cancelled. You can cancel anytime from Billing; access continues to the end of the paid period.",
        "Payments are handled by Stripe; a VAT invoice is issued for each payment.",
      ]} />

      <H2 id="fair-use">Fair use on unlimited plans</H2>
      <P>&ldquo;Unlimited&rdquo; means your own centre&apos;s genuine instructors, staff and volunteers, however many you have; we don&apos;t charge per person and we don&apos;t block a centre for its size. If a single centre goes above {fairUse.fairUsePeople.toLocaleString("en-GB")} people, we&apos;ll contact you to agree the right plan together, and we&apos;ll never cut off or limit access without talking to you first. To protect everyone&apos;s email delivery, each centre can send up to {fairUse.inviteDailyCap.toLocaleString("en-GB")} invitation emails a day; any more are sent automatically the next day.</P>

      <H2>Your data</H2>
      <P>Your data remains yours. We process it under our Privacy Policy and Data Processing terms. You can export it at any time, and after cancellation we provide a window to export before deletion.</P>

      <H2>Availability</H2>
      <P>We aim for high availability but the service is provided &ldquo;as is&rdquo; without a guaranteed uptime unless separately agreed. We are not liable for losses arising from downtime, data entered incorrectly, or reliance on the tool in place of your own compliance checks — you remain responsible for meeting your RYA and legal obligations.</P>

      <H2>Limitation of liability</H2>
      <P>To the extent permitted by law, our total liability for any claim is limited to the fees you paid in the 12 months before the claim. We are not liable for indirect or consequential loss.</P>

      <H2>Suspension &amp; termination</H2>
      <P>We may suspend or end access for non-payment or serious breach of these terms. You may stop using the service at any time.</P>

      <H2>Changes &amp; contact</H2>
      <P>We may update these terms; we&apos;ll post the new version here and, for material changes, notify you. Questions: <a className="text-teal hover:underline" href="mailto:hello@activityroster.com">hello@activityroster.com</a>.</P>
    </LegalPage>
  );
}
