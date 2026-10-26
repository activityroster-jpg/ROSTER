import Link from "next/link";
import { CalendarCheck, CalendarClock, FileCheck, Smartphone } from "lucide-react";
import { apexDomain } from "@/lib/config";
import { StoreBadges } from "@/components/marketing/StoreBadges";
import { OG_IMAGE } from "@/lib/seo/og";

export const metadata = {
  title: "For instructors and staff",
  description: "How instructors and staff use ActivityRoster: your centre adds you, you get the app (or use the web), and your shifts, availability, leave, hours and certificates are in one place. You don't sign up on the website.",
  alternates: { canonical: "/instructors" },
  openGraph: { title: "ActivityRoster for instructors and staff", description: "Your centre adds you. Get the app, join by name or company code, and see your shifts.", url: "/instructors", type: "website", images: [OG_IMAGE] },
};

const STEPS = [
  { n: "1", title: "Your centre adds you", body: "Whoever runs your centre puts your email on their staff list, or gives you their 6-character company code. That's the invitation; there's nothing to sign up for on this website." },
  { n: "2", title: "Get the app", body: "Install ActivityRoster on your phone. On a computer, or while the iPhone app is on its way, the same thing works in a browser at the address below." },
  { n: "3", title: "Create your account in the app", body: "Name, email and a password, then a 6-digit code from your email. If your centre has already added you it's offered by name; otherwise type the company code. Choose a 4-digit PIN and you're in." },
];

const FAQ = [
  { q: "Does it cost me anything?", a: "No. Your centre pays one flat price for everyone; instructors and volunteers never pay." },
  { q: "My centre hasn't added me yet. What do I do?", a: "Ask them to add your email on their Instructors list, or for their company code (it's on their Settings page). With the code you can ask to join and an admin approves you." },
  { q: "I got an invitation email. Which button do I press?", a: "On your phone, get the app and create your account with the same email address: your centre is offered by name. On a computer, the button in the email sets your password and takes you to your schedule on the web." },
  { q: "Can I use it on a computer?", a: "Yes. The instructor sign-in works in any browser at the address below, with the same account as the app." },
  { q: "I work at more than one centre.", a: "Join each one (by name if they've listed you, or with its code) and switch between them in the app's Settings." },
  { q: "I run a centre. Where do I sign up?", a: "Centres are set up on the website, not in the app: start your free month at activityroster.com/start. Your instructors then join the way described here." },
];

/**
 * The page for the other half of the audience. Instructors keep landing on the
 * centre sign-up because it was the only door on the site; this is theirs.
 */
export default function InstructorsPage() {
  const apex = apexDomain();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#4fd1c5]">Instructors and staff</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight md:text-4xl" style={{ textWrap: "balance" }}>You don&rsquo;t sign up here. Your centre adds you.</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">ActivityRoster is the system your sailing school or club uses for its roster. Your part is the app: your shifts, your availability, leave, hours and certificates, in your pocket.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="/app" className="rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-teal-700">Instructor sign-in →</a>
            <StoreBadges />
          </div>
          <p className="mt-3 text-sm text-white/60">In a browser: <span className="font-mono text-white/80">{apex}/app</span></p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-navy">Three steps, once</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-card border border-slate-200 bg-white p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal font-display text-lg font-bold text-white">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-slate-600">Already have an account? <a href="/app" className="font-semibold text-teal hover:underline">Sign in</a>. Forgotten your password? The sign-in screen can email you a one-time code instead.</p>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="font-display text-2xl font-semibold text-navy">What the app does for you</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarCheck, t: "Your shifts", b: "Every session you're on, confirmed by the office, with who you're working with. Pick up open shifts when you're free." },
              { icon: CalendarClock, t: "Availability and leave", b: "Say when you're free in a few taps; book leave and see it approved." },
              { icon: FileCheck, t: "Certificates", b: "Your first aid, licences and checks with expiry dates, and a nudge before anything lapses." },
              { icon: Smartphone, t: "Hours", b: "What you've worked, by week, ready for pay day." },
            ].map((f) => (
              <div key={f.t} className="rounded-card border border-slate-200 bg-canvas p-5">
                <f.icon className="h-7 w-7 text-teal" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-navy">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-navy">Questions</h2>
        <dl className="mt-5 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-card border border-slate-200 bg-white p-4">
              <dt className="font-semibold text-navy">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-slate-500">Run a centre? <Link href="/start" className="font-semibold text-teal hover:underline">Start your free month</Link> on the website, then add your team.</p>
      </section>
    </div>
  );
}
