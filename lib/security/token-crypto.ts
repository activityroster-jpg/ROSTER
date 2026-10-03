import { getEnv, type CloudflareEnv } from "@/lib/cf/bindings";
import { authSecret } from "./secrets";

/**
 * At-rest encryption for third-party API tokens (booking-system integrations).
 * AES-256-GCM via Web Crypto; the key is derived from TOKEN_ENCRYPTION_KEY when
 * set, otherwise from the auth secret, so nothing new is required to deploy.
 * Stored form: "enc:v1:<iv>.<ciphertext>" (base64url). Anything without the
 * prefix is treated as a legacy plaintext token and still works; it is sealed
 * the next time the integration is saved.
 */
const PREFIX = "enc:v1:";
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export function tokenSecret(env: CloudflareEnv = getEnv()): string {
  const k = env.TOKEN_ENCRYPTION_KEY;
  return k && k.length >= 16 ? k : authSecret(env);
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`${secret}:integration-token:v1`));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export const isSealed = (s: string | null | undefined): boolean => typeof s === "string" && s.startsWith(PREFIX);

/** Encrypt a token for storage. */
export async function sealToken(plain: string, secret: string = tokenSecret()): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(plain));
  return `${PREFIX}${b64u(iv)}.${b64u(new Uint8Array(ct))}`;
}

/**
 * Decrypt a stored token. Legacy plaintext passes through unchanged; a sealed
 * value that fails to decrypt (wrong key, tampered) yields null rather than a
 * garbage token being sent to a third party.
 */
export async function openToken(stored: string | null | undefined, secret: string = tokenSecret()): Promise<string | null> {
  if (!stored) return null;
  if (!isSealed(stored)) return stored;
  try {
    const [ivB, ctB] = stored.slice(PREFIX.length).split(".");
    if (!ivB || !ctB) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(ivB) }, await aesKey(secret), unb64u(ctB));
    return dec.decode(pt);
  } catch {
    return null;
  }
}
