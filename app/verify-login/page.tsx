import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { maskEmail } from "@/lib/security/mask";
import { VerifyLoginForm } from "@/components/auth/VerifyLoginForm";

export const dynamic = "force-dynamic";

/** Step two of an office sign-in: emailed code (unless 2FA just did that job), then "stay signed in?". */
export default async function VerifyLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/office";
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const twoFactor = Boolean((s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled);
  return <VerifyLoginForm next={next} emailHint={maskEmail(s.user.email)} preVerified={twoFactor} />;
}
