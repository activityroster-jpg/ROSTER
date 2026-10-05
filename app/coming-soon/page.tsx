import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { safeNext } from "@/lib/preview/gate";

export const metadata: Metadata = {
  title: "ActivityRoster · Coming soon",
  description: "Compliance-aware rostering for sailing and watersports centres. Coming soon.",
  robots: { index: false, follow: false },
};

/** The public website's front door while it is in preview (lib/preview/gate). */
export default async function ComingSoonPage({ searchParams }: { searchParams: Promise<{ wrong?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-16 text-center text-white">
      <Logo variant="onDark" size="lg" />
      <h1 className="mt-10 font-display text-4xl font-bold sm:text-5xl">Coming soon</h1>
      <p className="mt-4 max-w-md text-white/75">Compliance-aware rostering for sailing and watersports centres.</p>
      <form method="post" action="/api/preview" className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="pin" className="text-sm text-white/70">Have a preview PIN?</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]*"
          maxLength={12}
          required
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none placeholder:text-white/30 focus:border-white/60"
          placeholder="••••••"
        />
        {sp.wrong ? <p role="alert" className="text-sm text-amber-200">That PIN didn&apos;t work. Try again.</p> : null}
        <button type="submit" className="rounded-lg bg-white px-4 py-3 font-semibold text-navy hover:bg-white/90">View the site</button>
      </form>
      <p className="mt-12 text-xs text-white/50">Already using ActivityRoster? <a href="/login" className="underline hover:text-white">Sign in</a></p>
    </main>
  );
}
