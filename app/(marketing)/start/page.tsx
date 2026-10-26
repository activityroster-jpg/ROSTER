import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { headers } from "next/headers";
import { apexDomain } from "@/lib/config";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { isOfficeRole } from "@/lib/auth/rbac";
import { StartSignup } from "@/components/marketing/StartSignup";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Start your free month",
  description: "Create your centre on ActivityRoster in a minute: no card, free for a month, the RYA course types, instructor types and checks already in place.",
  alternates: { canonical: "/start" },
};

const PLANS = new Set(["small_club", "standard"]);

/**
 * The sign-up page. A box anywhere on the site sends people here with their
 * email filled in (and the lead already recorded), so this page is step two:
 * password and centre name. Arriving with nothing shows step one first.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(one("email")) ? one("email").toLowerCase().slice(0, 200) : "";
  const src = one("src").replace(/[^a-z0-9:_-]/gi, "").slice(0, 60) || "start";
  const plan = PLANS.has(one("plan")) ? one("plan") : undefined;
  const type = one("type") === "padi_centre" ? "padi_centre" : "rya_centre";
  const apex = apexDomain();
  // Already signed in (an instructor starting a club, or someone who made their
  // account in the app first): the centre is created for that login, no new password.
  const session = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) }).catch(() => null);
  const signedInAs = session?.user?.email ?? null;
  const runs = session?.user
    ? (await (await getRepositories()).control.membershipsForUser(session.user.id)).filter((m) => m.status === "active" && m.orgStatus === "active" && isOfficeRole(m.role)).map((m) => ({ name: m.name, slug: m.slug }))
    : [];

  return (
    <div className="bg-canvas">
      <div className="mx-auto grid max-w-5xl items-start gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:py-16">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">Free for a month</p>
          <h1 className="font-display text-3xl font-bold text-navy md:text-4xl" style={{ textWrap: "balance" }}>Your centre, set up in a minute</h1>
          <p className="mt-3 text-slate-600">Your centre starts with the {type === "padi_centre" ? "PADI" : "RYA"} course types, instructor types, certificates and checks already in place. A short guided set-up in the office does the rest.</p>
          <ul className="mt-5 space-y-2 text-sm text-slate-700">
            {["No card required, cancel any time", `From £35 a month afterwards, nothing per user`, "Hosted in the EU, export your data whenever you like", "Your team's instructor app for iPhone and Android"].map((x) => (
              <li key={x} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-teal" aria-hidden />{x}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-500">
            Prefer to see it first? <Link href="/demo" className="font-semibold text-teal hover:underline">Take the tour</Link> · Already have a centre? <Link href="/sign-in" className="font-semibold text-teal hover:underline">Sign in</Link>
          </p>
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-navy">Instructor or staff member?</span> You don&rsquo;t create a centre: yours adds you, and you use the app.{" "}
            <Link href="/instructors" className="font-semibold text-teal hover:underline">How it works →</Link>
          </p>
        </div>
        <StartSignup apex={apex} initialEmail={signedInAs ?? email} source={src} leadCaptured={one("lead") === "1"} plan={plan} defaultActivityType={type} signedInAs={signedInAs} runs={runs} />
      </div>
    </div>
  );
}
