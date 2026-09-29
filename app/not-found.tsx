import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="font-display text-5xl font-bold text-navy">404</p>
      <p className="mt-2 text-lg font-semibold text-navy">Page not found</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
      <Link href="/" className="mt-6 rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
        Go to homepage
      </Link>
    </div>
  );
}
