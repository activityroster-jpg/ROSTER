import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import { SignOutLink } from "@/components/SignOutLink";
import { StoreBadges } from "@/components/marketing/StoreBadges";
import { goDestination } from "@/lib/auth/go";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose your centre", robots: { index: false } };

/**
 * After signing in on the main site: find the centres this account belongs
 * to and go there. One centre → straight through. Several → pick. None → the
 * two doors, plainly: join a centre as an instructor, or create one.
 * Membership is still checked by the centre itself on arrival; this page only routes.
 */
export default async function GoPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const sp = await searchParams;
  const to = sp.to === "portal" ? "portal" : "office";
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect(`/sign-in?next=${encodeURIComponent(`/go?to=${to}`)}`);
  const { control } = await getRepositories();
  const apex = apexDomain();
  const d = goDestination(await control.membershipsForUser(s.user.id), to, apex);
  if (d.kind === "open") redirect(d.url);

  if (d.kind === "choose") {
    return (
      <section className="mx-auto max-w-xl px-4 py-14">
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h1 className="font-display text-2xl font-semibold text-navy">Which centre?</h1>
          <p className="mt-1 text-sm text-slate-500">Your account belongs to more than one.</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {d.centres.map((m) => (
              <li key={m.organisationId}>
                <a href={`https://${m.slug}.${apex}/${d.target}`} className="flex items-center justify-between py-3 hover:text-teal">
                  <span><span className="font-medium text-navy">{m.name}</span><span className="block text-xs text-slate-400">{m.slug}.{apex} · {m.role.replace(/_/g, " ")}</span></span>
                  <span className="text-teal">Open →</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-display text-2xl font-semibold text-navy">This login isn&rsquo;t in a centre yet</h1>
      <p className="mt-2 text-sm text-slate-600">You&rsquo;re signed in as <span className="font-semibold text-navy">{s.user.email}</span>. Nothing is wrong; pick the door that fits.</p>
      {d.pending.length ? (
        <p className="mt-4 rounded-lg border border-amber/40 bg-amber/5 px-4 py-3 text-sm text-navy">
          <span className="font-semibold">Waiting for {d.pending.map((m) => m.name).join(" and ")} to approve you.</span> They&rsquo;ve been told; you&rsquo;ll get an email as soon as they do.
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-card border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">Instructor or staff member</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-navy">Your centre adds you</h2>
          <p className="mt-1 flex-1 text-sm text-slate-600">Ask whoever runs your centre to add <span className="font-medium text-navy">{s.user.email}</span> to their staff list, or for their 6-character company code. Then sign in to the instructor app and your centre is offered by name.</p>
          <a href="/app" className="mt-4 rounded-lg bg-teal px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-700">Open the instructor sign-in →</a>
          <StoreBadges className="mt-3" />
          <Link href="/instructors" className="mt-3 text-xs font-medium text-slate-500 hover:text-navy">How the instructor side works →</Link>
        </div>
        <div className="flex flex-col rounded-card border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">Running a centre or club</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-navy">Create your centre</h2>
          <p className="mt-1 flex-1 text-sm text-slate-600">Centres are set up here on the website, not in the app. This login can own one: it takes a minute, no card, free for a month.</p>
          <Link href="/start" className="mt-4 rounded-lg border-2 border-teal px-4 py-2.5 text-center text-sm font-semibold text-teal hover:bg-teal/5">Create my centre →</Link>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">Signed in with the wrong email? <SignOutLink /> and try again.</p>
    </section>
  );
}
