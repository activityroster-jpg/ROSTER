import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getEnv } from "@/lib/cf/bindings";
import { resolveTenant } from "@/lib/tenant/resolve";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { SignOutButton } from "@/components/portal/SignOutButton";

export const dynamic = "force-dynamic";

/**
 * Shown when a signed-in person reaches a centre they don't belong to. Says
 * who they are and which centre this is, because the usual causes are a
 * second account, a different centre's address, or the platform owner opening
 * a centre's site directly instead of through Ghost Mode.
 */
export default async function NoAccessPage() {
  const h = new Headers(await headers());
  const env = getEnv();
  const s = await (await getAuth()).api.getSession({ headers: h });
  const res = await resolveTenant(h);
  const centre = !res.ok ? res.organisation : null;
  const slug = !res.ok ? res.slug : null;
  const email = s?.user?.email ?? null;
  const owner = await isPlatformAdminEmail(email);
  const staging = env.APP_ENV === "staging";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-navy">No access to this centre</h1>
      <p className="mt-2 text-slate-600">
        {email ? <>You&rsquo;re signed in as <span className="font-semibold text-navy">{email}</span>, and that account isn&rsquo;t a member of </> : <>Your account isn&rsquo;t a member of </>}
        {centre ? <span className="font-semibold text-navy">{centre.name}</span> : slug ? <span className="font-mono text-navy">{slug}.{env.APP_APEX_DOMAIN}</span> : "this centre"}
        {staging ? <> on <span className="font-semibold">staging</span></> : null}.
      </p>
      <ul className="mt-5 w-full space-y-2 text-left text-sm text-slate-600">
        <li className="rounded-lg border border-slate-200 bg-white p-3">If this is your centre, you may have signed in with a different email than the one it was set up with. Sign out below and sign in with that one.</li>
        <li className="rounded-lg border border-slate-200 bg-white p-3">If you work here, ask the centre admin to invite you from Office → Staff; the invite email takes you straight in.</li>
        {staging && !centre ? <li className="rounded-lg border border-amber-200 bg-amber-50 p-3">Staging has its own centres and accounts. A centre from the live site doesn&rsquo;t exist here until you create it at staging.activityroster.com.</li> : null}
        {owner && centre ? <li className="rounded-lg border border-teal/30 bg-teal/5 p-3">You&rsquo;re the platform owner. To look inside a centre without being a member, open it read-only through <a href={`https://${env.APP_APEX_DOMAIN}/admin/centres/${centre.id}`} className="font-semibold text-teal hover:underline">Ghost Mode in the Dev Center</a>.</li> : null}
      </ul>
      <div className="mt-6 flex items-center gap-3">
        {email ? <SignOutButton to="/sign-in" /> : <a href="/sign-in" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Sign in</a>}
        <a href={`https://${env.APP_APEX_DOMAIN}/login`} className="text-sm font-medium text-slate-500 hover:text-navy">Pick a different centre</a>
      </div>
    </div>
  );
}
