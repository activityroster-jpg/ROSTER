import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const metadata = { title: "Cookie Notice" };

/**
 * Keep this list in step with the cookies the code sets: the *_COOKIE constants
 * in lib/auth (pin, login-verify, device, centre-cookie, ghost) and the
 * onboarding cookie, plus Better Auth's session cookie and the localStorage
 * keys in lib/mobile/native.ts and the sign-in page.
 */
export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Notice" updated="4 October 2026">
      <P>ActivityRoster uses only the cookies and browser storage strictly necessary to run the service and keep it secure. There are no advertising, analytics or third-party tracking cookies, and we will ask before ever adding one.</P>

      <H2>Cookies we set</H2>
      <P>All of these are first-party, marked HttpOnly and Secure, and signed where they carry a claim, so they cannot be read or forged by scripts.</P>
      <UL items={[
        <><strong>Session</strong> (set by our sign-in library): keeps you signed in. Lasts until you sign out or the session expires; office sessions end after 12 hours without activity.</>,
        <><strong>ar_pin</strong>: records that you have entered your login PIN in this session. Slides forward while you are active and lapses after your centre&rsquo;s idle timeout (30 minutes unless changed).</>,
        <><strong>ar_lv, ar_lvs, ar_lvp, ar_lvd</strong>: record that an office sign-in was confirmed by an emailed code or authenticator on this browser, and your &ldquo;stay signed in&rdquo; choice. Up to 12 hours of inactivity, or until the browser closes for &ldquo;just this once&rdquo;.</>,
        <><strong>ar_dev</strong>: a random identifier for this browser so we can tell a new device from a known one and ask for your password again when it changes. Long-lived.</>,
        <><strong>ar_totp</strong>: records that the platform owner has entered their authenticator code in this session (Dev Center only).</>,
        <><strong>ar_centre</strong>: in the mobile app, which centre you have selected. Signed to your account.</>,
        <><strong>ar_ghost</strong>: present only while the platform owner is viewing a centre read-only for support; the centre sees every such visit in its change log.</>,
        <><strong>ar_onboarded</strong>: remembers that you dismissed the set-up checklist. One year.</>,
        <><strong>Turnstile</strong>: Cloudflare&rsquo;s bot check on the public forms and sign-in may set its own short-lived cookie on the challenges.cloudflare.com domain.</>,
      ]} />

      <H2>Browser storage</H2>
      <UL items={[
        <><strong>ar.signin.mode</strong>: which sign-in method you used last, so the right form opens first.</>,
        <><strong>ar.bio</strong> and <strong>ar.push.token</strong> (mobile app only): whether you turned on fingerprint or face unlock, and the device&rsquo;s push-notification token so we can remove it when you sign out.</>,
      ]} />

      <H2>Why there is no consent banner for these</H2>
      <P>Strictly necessary cookies and storage do not require consent under PECR and the GDPR, because the service cannot work without them. We show a short notice so you know they are used.</P>

      <H2>Managing cookies</H2>
      <P>You can clear or block cookies in your browser settings. Blocking them means you cannot stay signed in, and the security checks will ask for your password and PIN more often.</P>

      <H2>Contact</H2>
      <P><a className="text-teal hover:underline" href="mailto:privacy@activityroster.com">privacy@activityroster.com</a></P>
    </LegalPage>
  );
}
