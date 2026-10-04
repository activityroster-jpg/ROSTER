import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import { DEVICE_COOKIE, DEVICE_HEADER, isDeviceId } from "./device";
import { requestFingerprint } from "@/lib/security/events";

/** The current request's device id (cookie, or the header the middleware forwarded). */
export async function currentDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(DEVICE_COOKIE)?.value;
  if (isDeviceId(fromCookie)) return fromCookie;
  const fromHeader = (await headers()).get(DEVICE_HEADER);
  return isDeviceId(fromHeader) ? fromHeader : null;
}

/**
 * Require that this user has confirmed THIS device in THIS country
 * with their password. Anything new → /verify-device (password, or an emailed
 * code for magic-link-only accounts), then back to `next`.
 *
 * A user with no confirmed devices yet (brand-new account, first magic-link
 * sign-in) has the current one trusted silently: the sign-in itself was the
 * proof, and there is no baseline to compare against.
 */
/**
 * `strict` (office users and platform admins): a new CITY also asks for the
 * password again, not only a new country. Instructors stay at country level,
 * since 4G on a beach changes network often but rarely city.
 */
export async function enforceDeviceGate(userId: string, next: string, organisationId: string | null, strict = false): Promise<void> {
  const deviceId = await currentDeviceId();
  const fp = await requestFingerprint();
  const ip = fp.ip ?? "unknown";
  if (!deviceId) redirect(`/verify-device?next=${encodeURIComponent(next)}`);

  const { control } = await getRepositories();
  if (await control.isTrustedDevice(userId, deviceId, ip, fp.country, fp.city, strict)) return;

  if ((await control.countTrustedDevices(userId)) === 0) {
    await control.trustDevice({ userId, deviceId, ip, country: fp.country, city: fp.city, userAgent: fp.userAgent });
    await control.logSecurityEvent({ userId, organisationId, kind: "new_device", ...fp, meta: JSON.stringify({ first: true }) }).catch(() => {});
    return;
  }

  redirect(`/verify-device?next=${encodeURIComponent(next)}`);
}
