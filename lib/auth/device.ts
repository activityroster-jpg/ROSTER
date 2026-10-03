/**
 * Device identity for the unfamiliar-device check. The id is random, lives in
 * a long-lived httpOnly cookie, and is forwarded by the middleware as a request
 * header so server code can read it on the very request that created it.
 * It proves nothing on its own — it is one of three things (device, IP,
 * country) that must all be previously confirmed with a password.
 */
export const DEVICE_COOKIE = "ar_dev";
export const DEVICE_HEADER = "x-ar-device";
/** The request path, forwarded by the middleware so server code can route on it (e.g. the trial lock). */
export const PATH_HEADER = "x-ar-path";
export const DEVICE_MAX_AGE_S = 400 * 24 * 60 * 60; // browsers cap cookies at ~400 days

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isDeviceId = (v: string | undefined | null): v is string => typeof v === "string" && UUID.test(v);
