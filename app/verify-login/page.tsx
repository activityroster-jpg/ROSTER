import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { maskEmail } from "@/lib/security/mask";
import { authSecret } from "@/lib/security/secrets";
import { LV_DEVICE_COOKIE, LV_PENDING_COOKIE, verifyLvDevice, verifyLvPending } from "@/lib/auth/login-verify";
import { officeLandingFor, resolveHost } from "@/lib/tenant/host";
import { apexDomain } from "@/lib/config";
import { VerifyLoginForm } from "@/components/auth/VerifyLoginForm";

export const dynamic = "force-dynamic";

/** Step two of an office sign-in: emailed code (first time on a device, or after 12 idle hours; 2FA counts instead), then "stay signed in?". */
export default async function VerifyLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const h = new Headers(await headers());
  const asked = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/office";
  // On the main site the office isn't served: carry on via the centre chooser.
  const next = officeLandingFor(asked, resolveHost(h.get("host"), apexDomain()));
  const s = await (await getAuth()).api.getSession({ headers: h });
  if (!s?.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const twoFactor = Boolean((s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled);
  const jar = await cookies();
  const recentDevice = await verifyLvDevice(authSecret(), s.user.id, jar.get(LV_DEVICE_COOKIE)?.value);
  // Signed in from an emailed link or code moments ago: the email is already proved.
  const emailProved = await verifyLvPending(authSecret(), s.session.id, jar.get(LV_PENDING_COOKIE)?.value);
  return <VerifyLoginForm next={next} emailHint={maskEmail(s.user.email)} preVerified={twoFactor || recentDevice || emailProved} />;
}
