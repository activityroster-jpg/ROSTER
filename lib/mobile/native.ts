/**
 * Thin, client-only helpers over the Capacitor bridge. Every function is safe
 * to call in an ordinary browser: `isNative()` is false and the rest no-op.
 * Plugins are imported lazily so the web bundle never evaluates native code
 * paths unless the page is actually running inside the app.
 */
import type { PushPlatform } from "@/lib/db/schema";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  /** Runtime plugin registry — lets us use core plugins without a web-bundle dependency. */
  Plugins?: { App?: { addListener: (event: "appUrlOpen", cb: (ev: { url: string }) => void) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> } } };
}
const cap = (): CapacitorGlobal | undefined => (typeof window !== "undefined" ? (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor : undefined);

export const isNative = (): boolean => Boolean(cap()?.isNativePlatform?.());
export const nativePlatform = (): PushPlatform => {
  const p = cap()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
};

/** Stable per-install id for pairing push tokens with the device (mirrors the ar_dev cookie idea, app-side). */
export function appInstallId(): string {
  try {
    const k = "ar.install";
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
    return v;
  } catch { return "unknown"; }
}

// --- Push notifications ----------------------------------------------------

/**
 * Ask permission, register with APNs/FCM and hand the token to the server.
 * Resolves to "granted" | "denied" | "unavailable".
 */
export async function enablePush(): Promise<"granted" | "denied" | "unavailable"> {
  if (!isNative()) return "unavailable";
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return "denied";

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", async ({ value }) => {
    try {
      await fetch("/api/mobile/push-token", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ token: value, platform: nativePlatform(), deviceId: appInstallId() }),
      });
      try { localStorage.setItem("ar.push.token", value); } catch { /* ignore */ }
    } catch { /* retried next launch */ }
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", (ev) => {
    const url = (ev.notification.data as { url?: string } | undefined)?.url;
    if (url && url.startsWith("/")) window.location.href = url;
  });
  await PushNotifications.register();
  return "granted";
}

export async function disablePush(): Promise<void> {
  if (!isNative()) return;
  let token: string | null = null;
  try { token = localStorage.getItem("ar.push.token"); } catch { /* ignore */ }
  if (token) {
    await fetch("/api/mobile/push-token", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ token }) }).catch(() => {});
    try { localStorage.removeItem("ar.push.token"); } catch { /* ignore */ }
  }
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.removeAllListeners();
}

export function pushEnabled(): boolean {
  try { return Boolean(localStorage.getItem("ar.push.token")); } catch { return false; }
}

// --- Biometric unlock (Face ID / fingerprint) instead of typing the PIN -----

const BIO_SERVER = "activityroster.pin";

export async function biometricsAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    const r = await NativeBiometric.isAvailable();
    return Boolean(r.isAvailable);
  } catch { return false; }
}

/** Store the PIN in the device keychain / keystore so biometrics can release it. */
export async function savePinForBiometrics(userId: string, pin: string): Promise<void> {
  const { NativeBiometric } = await import("capacitor-native-biometric");
  await NativeBiometric.setCredentials({ username: userId, password: pin, server: BIO_SERVER });
  try { localStorage.setItem("ar.bio", userId); } catch { /* ignore */ }
}

export async function forgetBiometricPin(): Promise<void> {
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.deleteCredentials({ server: BIO_SERVER });
  } catch { /* ignore */ }
  try { localStorage.removeItem("ar.bio"); } catch { /* ignore */ }
}

export function biometricPinSaved(): boolean {
  try { return Boolean(localStorage.getItem("ar.bio")); } catch { return false; }
}

/** Prompt Face ID / fingerprint; on success return the stored PIN, else null. */
export async function unlockPinWithBiometrics(): Promise<string | null> {
  if (!isNative() || !biometricPinSaved()) return null;
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({ reason: "Unlock ActivityRoster", title: "Unlock", subtitle: "Use Face ID or fingerprint instead of your PIN", useFallback: true });
    const c = await NativeBiometric.getCredentials({ server: BIO_SERVER });
    return /^\d{4}$/.test(c.password) ? c.password : null;
  } catch {
    return null;
  }
}

// --- Universal / app links ---------------------------------------------------

const APP_HOST_RE = /^https:\/\/([a-z0-9-]+\.)?activityroster\.com(\/|$)/i;
let deepLinksReady = false;

/**
 * When iOS/Android hand the app one of our links (a sign-in link, a device
 * confirmation, a roster notification), load it inside the app instead of
 * dropping the user on the home screen. Only our own domain is followed.
 * Safe in a browser: does nothing.
 */
export function initDeepLinks(): void {
  if (!isNative() || deepLinksReady) return;
  const app = cap()?.Plugins?.App;
  if (!app) return;
  deepLinksReady = true;
  void app.addListener("appUrlOpen", ({ url }) => {
    if (typeof url === "string" && APP_HOST_RE.test(url)) window.location.href = url;
  });
}
