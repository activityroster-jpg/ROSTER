import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const metadata = { title: "Data Processing" };

export default function DataProcessingPage() {
  return (
    <LegalPage title="Data Processing Terms" updated="4 October 2026">
      <P>These terms apply where ActivityRoster processes personal data on behalf of a centre (the &ldquo;Controller&rdquo;) — for example the instructor, cert (qualification) and compliance records a centre stores in the platform. They form part of our agreement with each centre and reflect Article 28 UK/EU GDPR.</P>

      <H2>Roles</H2>
      <P>The centre is the Controller of its staff/operational data. ActivityRoster, operated by ActiveRoster Ltd (registered in England &amp; Wales, company number 17505500, registered office 71-75 Shelton Street, London WC2H 9JQ, United Kingdom), is the Processor and processes that data only on the centre&apos;s documented instructions (using the platform as intended).</P>

      <H2>Subject matter &amp; duration</H2>
      <P>Processing lasts for the term of the subscription plus the post-termination export/retention window. Subject matter: provision of rostering, compliance-tracking and course-administration services.</P>

      <H2>Nature &amp; purpose</H2>
      <UL items={[
        "Storing and displaying instructor records, certs (qualifications), vetting/DBS status, availability, hours and leave.",
        "Sending service notifications (e.g. shift offers, leave decisions) on the centre's behalf.",
        "Generating rosters, timesheets and payroll-ready exports.",
      ]} />

      <H2>Types of data &amp; data subjects</H2>
      <P>Data subjects: the centre&apos;s instructors and staff. Data: contact details, employment type, certs (qualifications), compliance/vetting records (which may be special-category or criminal-offence data such as DBS status), working time and leave.</P>

      <H2>Our obligations</H2>
      <UL items={[
        "Process only on the Controller's instructions.",
        "Keep data confidential and ensure staff are bound by confidentiality.",
        "Apply appropriate technical and organisational security (encryption in transit, hashed credentials, per-centre isolation, access control, EU data residency).",
        "Assist the Controller with data-subject requests, breach notification and DPIAs.",
        "Use sub-processors only under equivalent terms, and tell you of changes.",
        "On termination, delete or return the data after the export window.",
      ]} />

      <H2>Sub-processors</H2>
      <P>The current sub-processors, what each does, where it runs and a dated record of every change are published at <a className="text-teal hover:underline" href="/subprocessors">activityroster.com/subprocessors</a>. We tell centre admins by email at least 30 days before a new sub-processor handles their data, and a centre may object in that time.</P>

      <H2>International transfers</H2>
      <P>Platform data is stored in the EU. Where a sub-processor transfers data outside the UK/EEA, it is covered by an adequacy decision or Standard Contractual Clauses.</P>

      <H2>Contact</H2>
      <P>To request a signed DPA or the sub-processor list: <a className="text-teal hover:underline" href="mailto:privacy@activityroster.com">privacy@activityroster.com</a>.</P>
    </LegalPage>
  );
}
