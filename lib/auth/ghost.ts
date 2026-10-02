/**
 * Ghost Mode — the platform owner views a centre's office READ-ONLY, without
 * the centre seeing anything (no membership row, no tenant audit entries).
 *
 * A short-lived, HMAC-signed cookie on the apex domain names the org and the
 * admin it was issued to. lib/tenant/resolve honours it only when the session
 * user is a platform admin AND the cookie's admin id matches; the resulting
 * TenantContext carries `ghost: true`, which the repository layer and R2
 * helpers refuse to write with. Starts and ends are logged owner-side only.
 */
export const GHOST_COOKIE = "ar_ghost";
export const GHOST_TTL_S = 30 * 60;

export interface GhostClaims {
  organisationId: string;
  adminUserId: string;
  /** Unix seconds. */
  exp: number;
}

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

export async function signGhostToken(secret: string, claims: GhostClaims): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(secret, `ghost:${payload}`)}`;
}

/** Verified claims, or null if missing, tampered or expired. */
export async function verifyGhostToken(secret: string, token: string | null | undefined, now = Date.now()): Promise<GhostClaims | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!timingSafeEqual(await hmac(secret, `ghost:${payload}`), sig)) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(unb64url(payload))) as Partial<GhostClaims>;
    if (typeof claims.organisationId !== "string" || typeof claims.adminUserId !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return claims as GhostClaims;
  } catch {
    return null;
  }
}

/** Read one cookie out of a raw Cookie header. */
export function cookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=") || null;
  }
  return null;
}

/** Thrown by the repository / R2 layer when a ghost context tries to write. */
export class GhostReadOnlyError extends Error {
  constructor() {
    super("Ghost mode is read-only — nothing can be changed while viewing a centre as the platform owner.");
    this.name = "GhostReadOnlyError";
  }
}
