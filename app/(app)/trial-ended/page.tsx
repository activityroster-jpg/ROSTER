import Link from "next/link";

export const dynamic = "force-dynamic";

/** Instructors land here once their centre's free trial has fully ended. */
export default function TrialEndedPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-navy">This centre&apos;s free trial has ended</h1>
      <p className="mt-2 text-slate-600">
        Nothing is lost. Once your centre adds a payment method, everything comes straight back. Please let whoever runs
        your centre know.
      </p>
      <Link href="/sign-in" className="mt-6 text-sm font-medium text-teal hover:underline">Back to sign in</Link>
    </div>
  );
}
