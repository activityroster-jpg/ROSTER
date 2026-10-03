import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { AppSignIn } from "@/components/mobile/AppSignIn";
import { AutoOpenCentre } from "@/components/mobile/AutoOpenCentre";

export const dynamic = "force-dynamic";

/**
 * App start: signed in → straight to the right place; otherwise sign in /
 * create account. Nothing here writes a cookie: a page render may not, so the
 * single-centre case hands over to a client component that calls the
 * select-centre action (which sets the cookie and redirects).
 */
export default async function AppStartPage() {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) return <AppSignIn />;
  const { control } = await getRepositories();
  const ms = await control.membershipsForUser(s.user.id);
  const active = ms.filter((m) => m.status === "active" && m.orgStatus === "active");
  if (active.length === 1) return <AutoOpenCentre organisationId={active[0]!.organisationId} name={active[0]!.name} />;
  if (active.length > 1) redirect("/app/switch");
  redirect(ms.some((m) => m.status === "requested") ? "/app/join?pending=1" : "/app/join");
}
