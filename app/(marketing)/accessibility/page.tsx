import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "How accessible ActivityRoster is, what we know does not yet meet WCAG 2.2 AA, and how to tell us about a problem.",
};

/**
 * Compliance P1-G. The known-issues list below is the output of the October
 * 2026 self-audit (docs/platform-review-2026-10.md, Accessibility); update it as
 * items are fixed so the page stays honest.
 */
export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility statement" updated="4 October 2026">
      <P>This statement covers the ActivityRoster website (activityroster.com), the centre office and instructor portal (yourcentre.activityroster.com) and the instructor mobile app. We want everyone who runs or teaches at a centre to be able to use them, including people who rely on a keyboard, a screen reader, magnification or a high-contrast setting.</P>

      <H2>What we aim for</H2>
      <P>We work to the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. Every page uses real headings and landmarks, has a &ldquo;Skip to main content&rdquo; link, shows a visible focus ring on every control, respects the operating system&rsquo;s reduced-motion setting, keeps text resizable to 200 percent without loss, and labels every form field. Colour is never the only way information is given: roster warnings carry text as well as a colour, and the roster PDF has a black-and-white style.</P>

      <H2>How accessible it is now</H2>
      <P>The service is <strong>partially conformant</strong> with WCAG 2.2 AA. The parts listed below do not yet fully meet it.</P>
      <UL items={[
        "A few owner-only pages in the platform&rsquo;s Dev Center have form labels that are next to, rather than attached to, their fields. These pages are used by one person and are being tidied.",
        "The availability grid and the weekly roster are dense tables; they work with a keyboard but are slow with a screen reader. A list view for assistive technology is planned.",
        "Some icons in the mobile app rely on colour contrast that is just under the AA threshold on the brightest screens.",
        "Emails we send are plain, single-column HTML, but have not been tested against every email client&rsquo;s screen-reader behaviour.",
        "Charts in the Finance area are drawn as images with a text summary rather than a full data table.",
      ]} />

      <H2>How we test</H2>
      <P>Each change is checked with keyboard-only navigation, a browser accessibility audit and a screen reader on the pages it touches, and the whole service is re-audited at least once a year. The last full review was in October 2026.</P>

      <H2>Tell us about a problem</H2>
      <P>If anything is hard to use, or you need information from the service in a different format, email <a className="text-teal hover:underline" href="mailto:support@activityroster.com">support@activityroster.com</a> or use the <Link href="/contact" className="text-teal hover:underline">contact form</Link>. Say which page and what happened. We reply within five working days and fix what we can straight away.</P>

      <H2>Enforcement</H2>
      <P>In the UK the Equality and Human Rights Commission enforces the Equality Act 2010&rsquo;s accessibility duties; in Ireland the Irish Human Rights and Equality Commission does the equivalent. If you are not happy with how we respond, you can contact them.</P>
    </LegalPage>
  );
}
