import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { resolveTenant } from "@/lib/tenant/resolve";
import { officeLandingFor, resolveHost } from "@/lib/tenant/host";
import { apexDomain } from "@/lib/config";
import { CreateAccountForm } from "@/components/auth/CreateAccountForm";

export const dynamic = "force-dynamic";

const SAFE_NEXT = /^\/(office|portal|parent)(\/[A-Za-z0-9/_-]*)?$/;

/**
 * First stop after an invitation link: create your account. The link has
 * already proved the email address; here the person gives their name and
 * chooses a password, then carries on to the office (which asks for the
 * emailed code and a PIN) or their portal. Someone who already has a
 * password goes straight on.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const h = new Headers(await headers());
  // On the main site the office isn't served: carry on via the centre chooser.
  const next = officeLandingFor(typeof sp.next === "string" && SAFE_NEXT.test(sp.next) ? sp.next : "/office", resolveHost(h.get("host"), apexDomain()));
  const session = await (await getAuth()).api.getSession({ headers: h }).catch(() => null);
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const { control } = await getRepositories();
  if (await control.hasCredentialPassword(session.user.id)) redirect(next);
  const tenant = await resolveTenant(h).catch(() => null);
  const centre = tenant?.organisation?.name ?? null;
  const name = session.user.name && session.user.name !== session.user.email ? session.user.name : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Welcome</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">{centre ? `You've been invited to ${centre} on ActivityRoster. ` : ""}Your email is confirmed. Add your name and choose a password, and you&rsquo;re in.</p>
        <p className="mt-1 text-xs text-slate-400">Signed in as {session.user.email}</p>
        <CreateAccountForm initialName={name} next={next} />
      </div>
    </div>
  );
}
