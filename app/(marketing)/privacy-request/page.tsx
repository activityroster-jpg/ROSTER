import type { Metadata } from "next";
import { PrivacyRequestForm, type PrivacyRequestKind } from "@/components/marketing/PrivacyRequestForm";
import { PRIVACY_REQUEST_KINDS } from "@/lib/db/schema/control-plane";
import { PRIVACY_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data request or complaint",
  description: "Ask for a copy of your data, a correction or deletion, or make a data-protection complaint. We acknowledge within 30 days.",
};

// ?kind=erasure (the app's "Delete my account" link) preselects the request type; anything else is ignored.
// The check stays on the server side: a function exported from the "use client" form can't be called here.
const isKind = (k: unknown): k is PrivacyRequestKind => (PRIVACY_REQUEST_KINDS as readonly unknown[]).includes(k);

export default async function PrivacyRequestPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return (
    <section className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-display text-3xl font-bold text-navy">Data request or complaint</h1>
      <p className="mt-3 text-slate-600">Use this form to exercise your data-protection rights or to complain about how personal data has been handled. We log every request, send you a receipt straight away, and reply within 30 days. You can also email <a href={`mailto:${PRIVACY_CONTACT}`} className="font-semibold text-teal hover:underline">{PRIVACY_CONTACT}</a>.</p>
      <p className="mt-2 text-sm text-slate-500">If your request is about your records at a sailing centre or club that uses ActivityRoster, that centre is the data controller. We&rsquo;ll either pass your request to them or help them respond, and we&rsquo;ll tell you which.</p>
      <div className="mt-6"><PrivacyRequestForm initialKind={isKind(kind) ? kind : "access"} /></div>
    </section>
  );
}
