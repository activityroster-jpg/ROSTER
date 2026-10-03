import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { maskEmail } from "@/lib/security/mask";
import { authSecret } from "@/lib/security/secrets";
import { LV_DEVICE_COOKIE, verifyLvDevice } from "@/lib/auth/login-verify";
import { VerifyLoginForm } from "@/components/auth/VerifyLoginForm";

export const dynamic = "force-dynamic";

/** Step two of an office sign-in: emailed code (first time on a device, or after 12 idle hours; 2FA counts instead), then "stay signed in?". */
export default async function VerifyLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/office";
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const twoFactor = Boolean((s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled);
  const recentDevice = await verifyLvDevice(authSecret(), s.user.id, (await cookies()).get(LV_DEVICE_COOKIE)?.value);
  return <VerifyLoginForm next={next} emailHint={maskEmail(s.user.email)} preVerified={twoFactor || recentDevice} />;
}
