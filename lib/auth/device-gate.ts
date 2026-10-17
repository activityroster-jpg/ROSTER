import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRepositories } from "@/lib/cf/bindings";
import { DEVICE_COOKIE, DEVICE_HEADER, isDeviceId } from "./device";
import { describeAgent, notifySecurityChange, requestFingerprint } from "@/lib/security/events";
import { escapeHtml } from "@/lib/mail";

/** The current request's device id (cookie, or the header the middleware forwarded). */
export async function currentDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(DEVICE_COOKIE)?.value;
  if (isDeviceId(fromCookie)) return fromCookie;
  const fromHeader = (await headers()).get(DEVICE_HEADER);
  return isDeviceId(fromHeader) ? fromHeader : null;
}

/**
 * Ask for the password (or an emailed code) only when the account turns up
 * somewhere NEW: a country it has never been used from — or, for `strict`
 * users (office users and platform admins), a new city too, since 4G on a beach
 * changes network often but rarely city. Anything new → /verify-device, then
 * back to `next`.
 *
 * A new device on its own is not a challenge. A phone, laptop or browser the
 * account has not used before, in a place it has been used from, is trusted
 * silently and the person is emailed about it (the brief asks for an alert on
 * every new device; it does not ask for a second sign-in). A user with no
 * confirmed devices yet (brand-new account) has the current one trusted too:
 * the sign-in itself was the proof, and there is no baseline to compare against.
 */
export async function enforceDeviceGate(userId: string, next: string, organisationId: string | null, strict = false): Promise<void> {
  const deviceId = await currentDeviceId();
  const fp = await requestFingerprint();
  const ip = fp.ip ?? "unknown";
  if (!deviceId) redirect(`/verify-device?next=${encodeURIComponent(next)}`);

  const { control } = await getRepositories();
  if (await control.isTrustedDevice(userId, deviceId, ip, fp.country, fp.city, strict)) return;

  const first = (await control.countTrustedDevices(userId)) === 0;
  if (first || (await control.hasTrustedPlace(userId, fp.country, fp.city, strict))) {
    await control.trustDevice({ userId, deviceId, ip, country: fp.country, city: fp.city, userAgent: fp.userAgent });
    await control.logSecurityEvent({ userId, organisationId, kind: "new_device", ...fp, meta: JSON.stringify({ first, silent: true }) }).catch(() => {});
    if (!first) {
      const where = [describeAgent(fp.userAgent), fp.city, fp.country].filter(Boolean).map((v) => escapeHtml(String(v))).join(", ");
      await notifySecurityChange(
        userId,
        "New device on your ActivityRoster account",
        `<p>Your account was just used from a device we hadn't seen before (${where}), in a place you've signed in from before, so we didn't ask you to confirm it.</p><p>If this was you, there's nothing to do. If it wasn't, change your password now and use "Forget all devices" under Security.</p>`,
      ).catch(() => {});
    }
    return;
  }

  redirect(`/verify-device?next=${encodeURIComponent(next)}`);
}
