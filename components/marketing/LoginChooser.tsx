"use client";

/**
 * Apex-site sign-in: pick a door, sign in by email, and /go takes you to your
 * centre (or asks which, if you belong to several). Nobody types a web address.
 */
export function LoginChooser() {
  const door = (href: string, title: string, body: string, cta: string) => (
    <a href={href} className="group rounded-card border border-slate-200 bg-white p-6 text-left transition hover:border-teal hover:shadow-sm">
      <p className="font-display text-xl font-semibold text-navy">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      <span className="mt-4 inline-block rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white group-hover:bg-teal-700">{cta} →</span>
    </a>
  );
  return (
    <div className="mx-auto max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        {door("/sign-in?next=%2Fgo%3Fto%3Doffice", "Centre admin", "Run the roster, courses, team, documents and billing for your centre.", "Sign in to the office")}
        {door("/sign-in?next=%2Fgo%3Fto%3Dportal", "Instructor portal", "See your shifts, set availability, confirm sessions, swap and request leave.", "Sign in to my portal")}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Your email tells us which centre you belong to. If you belong to more than one, you choose after signing in.</p>
      <p className="mt-2 text-center text-sm text-slate-500">New here? <a href="/#get-demo" className="font-semibold text-teal hover:underline">Start your free month</a> and your centre is created instantly. On your phone? The <a href="/app" className="font-semibold text-teal hover:underline">ActivityRoster app</a> signs you in the same way.</p>
    </div>
  );
}
