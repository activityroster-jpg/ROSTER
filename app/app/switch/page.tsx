import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getEnv, getRepositories } from "@/lib/cf/bindings";
import { SwitchCentre } from "@/components/mobile/SwitchCentre";
import { centreCookieFromHeader, verifyCentreCookie } from "@/lib/auth/centre-cookie";
import { authSecret } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";

export default async function SwitchCentrePage() {
  const h = new Headers(await headers());
  const s = await (await getAuth()).api.getSession({ headers: h });
  if (!s?.user) redirect("/app");
  const { control } = await getRepositories();
  const ms = await control.membershipsForUser(s.user.id);
  if (ms.length === 0) redirect("/app/join");
  const current = await verifyCentreCookie(authSecret(getEnv()), centreCookieFromHeader(h.get("cookie")));
  const centres = ms
    .filter((m) => m.role === "instructor" || m.status === "active")
    .map((m) => ({ organisationId: m.organisationId, name: m.name, slug: m.slug, status: m.orgStatus !== "active" ? "suspended" : m.status, current: current?.organisationId === m.organisationId }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Your centres</h1>
      <p className="mb-5 text-sm text-slate-500">Pick the centre to open. You can switch any time from Settings.</p>
      <SwitchCentre centres={centres} joinHref="/app/join" />
    </div>
  );
}
