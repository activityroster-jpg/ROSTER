export const dynamic = "force-dynamic";

export default function SuspendedPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-navy">Centre suspended</h1>
      <p className="mt-2 text-slate-600">
        This centre&apos;s subscription is inactive. An admin can reactivate it from the billing portal. Your data
        is retained and can still be exported during the retention window.
      </p>
    </div>
  );
}
