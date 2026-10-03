/**
 * "Selected centre" for the mobile app. The app runs on the apex domain (one
 * origin, so the native bridge works everywhere), so the centre can't come
 * from the subdomain the way it does on the web. Instead a signed cookie names
 * the org the user picked; lib/tenant/resolve still requires an ACTIVE
 * membership for that org — the cookie is a hint, never authorisation.
 */
import { cookieFromHeader } from "./ghost";

export const CENTRE_COOKIE = "ar_centre";
export const CENTRE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

export interface CentreClaims { organisationId: string; userId: string }

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg))));
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function signCentreCookie(secret: string, claims: CentreClaims): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(secret, `centre:${payload}`)}`;
}

export async function verifyCentreCookie(secret: string, value: string | null | undefined): Promise<CentreClaims | null> {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || !timingSafeEqual(await hmac(secret, `centre:${payload}`), sig)) return null;
  try {
    const c = JSON.parse(new TextDecoder().decode(unb64url(payload))) as Partial<CentreClaims>;
    return typeof c.organisationId === "string" && typeof c.userId === "string" ? (c as CentreClaims) : null;
  } catch {
    return null;
  }
}

export const centreCookieFromHeader = (cookieHeader: string | null) => cookieFromHeader(cookieHeader, CENTRE_COOKIE);
