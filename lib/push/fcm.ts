/**
 * Push notifications via Firebase Cloud Messaging (HTTP v1), fetch-only so it
 * runs on Workers. Auth is a service-account JWT (RS256, Web Crypto) exchanged
 * for a short-lived OAuth token, cached in memory for the isolate's lifetime.
 * Everything is best-effort: a push failure never fails the action that
 * triggered it. Tokens FCM reports as dead are returned so the caller can
 * delete them.
 */
import type { CloudflareEnv } from "@/lib/cf/bindings";

interface ServiceAccount { project_id: string; client_email: string; private_key: string }

let cachedToken: { value: string; exp: number } | null = null;
let cachedKey: { email: string; key: CryptoKey } | null = null;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s: string) => b64url(new TextEncoder().encode(s));

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const sa = JSON.parse(json) as Partial<ServiceAccount>;
    return sa.project_id && sa.client_email && sa.private_key ? (sa as ServiceAccount) : null;
  } catch {
    return null;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  if (!cachedKey || cachedKey.email !== sa.client_email) {
    const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    cachedKey = { email: sa.client_email, key };
  }
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cachedKey.key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

export interface PushMessage { title: string; body?: string | null; url?: string; badge?: number }

/** Send one message to many tokens. Returns tokens FCM says are gone. */
export async function sendPush(env: CloudflareEnv, tokens: string[], msg: PushMessage): Promise<{ sent: number; dead: string[] }> {
  const sa = parseServiceAccount(env.FCM_SERVICE_ACCOUNT_JSON);
  if (!sa || tokens.length === 0) return { sent: 0, dead: [] };
  let bearer: string;
  try { bearer = await accessToken(sa); } catch (err) { console.warn("[push]", (err as Error).message); return { sent: 0, dead: [] }; }

  const dead: string[] = [];
  let sent = 0;
  await Promise.all(tokens.map(async (token) => {
    const payload = {
      message: {
        token,
        notification: { title: msg.title, ...(msg.body ? { body: msg.body } : {}) },
        data: { url: msg.url ?? "/portal/notifications" },
        apns: { payload: { aps: { sound: "default", ...(msg.badge != null ? { badge: msg.badge } : {}) } } },
        android: { priority: "HIGH", notification: { sound: "default", channel_id: "roster" } },
      },
    };
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { sent++; return; }
      const text = await res.text();
      if (res.status === 404 || /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text)) dead.push(token);
      else console.warn("[push] send failed", res.status, text.slice(0, 200));
    } catch (err) {
      console.warn("[push] send error", (err as Error).message);
    }
  }));
  return { sent, dead };
}
