import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { VerifyDeviceForm } from "@/components/auth/VerifyDeviceForm";
import { describeAgent, requestFingerprint } from "@/lib/security/events";

export const dynamic = "force-dynamic";

/**
 * Shown when a signed-in user arrives from a device, IP or country they
 * haven't confirmed before. Password (or emailed code) → device remembered →
 * on to the PIN as usual. Lives outside the office/portal layouts so the gate
 * can redirect here without looping.
 */
export default async function VerifyDevicePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const s = await (await getAuth()).api.getSession({ headers: new Headers(await headers()) });
  if (!s?.user) redirect("/sign-in");
  const { control } = await getRepositories();
  const hasPassword = await control.hasCredentialPassword(s.user.id);
  const fp = await requestFingerprint();
  const where = [describeAgent(fp.userAgent), fp.country].filter(Boolean).join(" · ");
  return <VerifyDeviceForm next={next} hasPassword={hasPassword} where={where} />;
}
