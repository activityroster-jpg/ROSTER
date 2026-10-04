import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { apexDomain } from "@/lib/config";
import { SignOutLink } from "@/components/SignOutLink";
import { isOfficeRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose your centre", robots: { index: false } };

/**
 * After signing in on the main site: find the centres this account belongs
 * to and go there. One centre → straight through. Several → pick. None → say
 * so plainly. Membership is still checked by the centre itself on arrival;
 * this page only routes.
 */
export default async function GoPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const sp = await searchParams;
  const to = sp.to === "portal" ? "portal" : "office";
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect(`/sign-in?next=${encodeURIComponent(`/go?to=${to}`)}`);
  const { control } = await getRepositories();
  const all = (await control.membershipsForUser(s.user.id)).filter((m) => m.status === "active" && m.orgStatus !== "cancelled");
  const centres = to === "office" ? all.filter((m) => isOfficeRole(m.role)) : all.filter((m) => m.role !== "parent" || to === "portal");
  const apex = apexDomain();
  const link = (slug: string, role?: string) => `https://${slug}.${apex}/${to === "office" ? "office" : role === "parent" ? "parent" : "portal"}`;

  if (centres.length === 1) redirect(link(centres[0]!.slug, centres[0]!.role));

  return (
    <section className="mx-auto max-w-xl px-4 py-14">
      {centres.length === 0 ? (
        <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-navy">{to === "office" ? "No centre office for this account yet" : "No centre has added you yet"}</h1>
          <p className="mt-3 text-sm text-slate-600">
            {to === "office"
              ? <>You are signed in as {s.user.email}, but this account does not run a centre. {all.length ? <>It is an instructor account at {all.map((m) => m.name).join(", ")}: <a href={`/go?to=portal`} className="font-semibold text-teal hover:underline">open the instructor portal</a>.</> : <>To set one up, <a href="/#get-demo" className="font-semibold text-teal hover:underline">start your free month</a>; your centre is created instantly.</>}</>
              : <>You are signed in as {s.user.email}, but no centre has added this address to its team. Ask whoever runs your centre to invite you with this email, or use the company code they gave you in the ActivityRoster app.</>}
          </p>
          <p className="mt-4 text-xs text-slate-400">Signed in with the wrong email? <SignOutLink /> and try again.</p>
        </div>
      ) : (
        <div className="rounded-card border border-slate-200 bg-white p-6">
          <h1 className="font-display text-2xl font-semibold text-navy">Which centre?</h1>
          <p className="mt-1 text-sm text-slate-500">Your account belongs to more than one.</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {centres.map((m) => (
              <li key={m.organisationId}>
                <a href={link(m.slug, m.role)} className="flex items-center justify-between py-3 hover:text-teal">
                  <span><span className="font-medium text-navy">{m.name}</span><span className="block text-xs text-slate-400">{m.slug}.{apex} · {m.role.replace(/_/g, " ")}</span></span>
                  <span className="text-teal">Open →</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
