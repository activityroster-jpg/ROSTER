import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isPlatformAdminEmail } from "@/lib/platform/admin";
import { SignOutLink } from "@/components/SignOutLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev Center sign in", robots: { index: false, follow: false } };

/**
 * The Dev Center's own front door (activityroster.com/dev). The centre sign-in
 * sends people to their centre's office; this one sends a platform admin to
 * /admin, through the same password, emailed code, PIN and authenticator gates.
 */
export default async function DevSignInPage() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) }).catch(() => null);
  const email = s?.user?.email ?? null;
  if (!email) redirect(`/sign-in?next=${encodeURIComponent("/admin")}`);
  if (await isPlatformAdminEmail(email)) redirect("/admin");
  return (
    <section className="mx-auto max-w-md px-4 py-14">
      <div className="rounded-card border border-slate-200 bg-white p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-navy">Not a Dev Center account</h1>
        <p className="mt-3 text-sm text-slate-600">You are signed in as {email}, which isn&rsquo;t on the Dev Center list. The list is the <code className="rounded bg-slate-100 px-1">PLATFORM_ADMIN_EMAILS</code> setting on the Worker.</p>
        <p className="mt-4 text-xs text-slate-400"><SignOutLink /> and sign in with the right email.</p>
      </div>
    </section>
  );
}
