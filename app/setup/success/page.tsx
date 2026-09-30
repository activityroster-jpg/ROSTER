export const dynamic = "force-dynamic";

export default function SetupSuccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="rounded-card border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-navy">Thank you — your setup is booked</h1>
        <p className="mt-3 text-slate-600">
          We&apos;ve received your payment for the done-for-you setup &amp; customisation service. A VAT receipt is on
          its way to your inbox.
        </p>
        <p className="mt-2 text-slate-600">
          We&apos;ll be in touch within one working day to arrange a short call, get your details and data, and start
          configuring your centre exactly how you want it.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          You can close this page — nothing else is needed from you right now.
        </p>
      </div>
    </div>
  );
}
