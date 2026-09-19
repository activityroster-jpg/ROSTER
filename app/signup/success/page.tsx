export const dynamic = "force-dynamic";

export default function SignupSuccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="rounded-card border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-navy">Payment received — setting up your centre</h1>
        <p className="mt-3 text-slate-600">
          We&apos;re provisioning your centre now. You&apos;ll receive an email with a sign-in link as soon as it&apos;s
          ready (usually within a minute).
        </p>
        <p className="mt-2 text-sm text-slate-500">
          You can close this page — everything happens automatically and securely on our side.
        </p>
      </div>
    </div>
  );
}
