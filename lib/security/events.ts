import { noteSecurityEvent } from "./alerts";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/cf/bindings";
import type { SecurityEventKind } from "@/lib/db/schema";
import { escapeHtml, sendEmail } from "@/lib/mail";

/** Where a request came from, as far as Cloudflare tells us. */
export interface RequestFingerprint {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  /** Cloudflare's best guess at the city; office users are challenged again from a new one. */
  city: string | null;
}

export async function requestFingerprint(): Promise<RequestFingerprint> {
  try {
    const h = await headers();
    return {
      ip: h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      country: h.get("cf-ipcountry") ?? null,
      city: h.get("cf-ipcity") ?? null,
    };
  } catch {
    return { ip: null, userAgent: null, country: null, city: null };
  }
}

/**
 * Record an account-security event (control plane, per user). Best-effort:
 * logging must never break the action it describes.
 */
export async function recordSecurityEvent(
  kind: SecurityEventKind,
  input: { userId: string; organisationId?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    const fp = await requestFingerprint();
    const { control } = await getRepositories();
    await control.logSecurityEvent({
      userId: input.userId,
      organisationId: input.organisationId ?? null,
      kind,
      ...fp,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
    await noteSecurityEvent(kind, input.userId, input.organisationId);
  } catch (err) {
    console.error("[security-event] failed to record", kind, (err as Error).message);
  }
}

/** Short, human description of a browser from its user-agent string. */
export function describeAgent(ua: string | null): string {
  if (!ua) return "an unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "a browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Email the user (account address + recovery address, plus any extra
 * recipients) that something security-relevant just changed. Includes where it
 * came from so they can spot an intruder. Best-effort.
 */
export async function notifySecurityChange(
  userId: string,
  subject: string,
  bodyHtml: string,
  extraTo: string[] = [],
): Promise<void> {
  try {
    const { control } = await getRepositories();
    const user = await control.userById(userId);
    if (!user) return;
    const fp = await requestFingerprint();
    const where = [describeAgent(fp.userAgent), fp.country ? `country ${fp.country}` : null, fp.ip ? `IP ${fp.ip}` : null].filter(Boolean).join(" · ");
    const html = `${bodyHtml}
      <p style="color:#64748b;font-size:12px">When: ${new Date().toUTCString()}<br>From: ${escapeHtml(where)}</p>
      <p style="color:#64748b;font-size:12px">If this wasn't you, change your password straight away from the sign-in page (“Forgot password”) and contact support.</p>`;
    const recipients = [...new Set([user.email, user.recoveryEmail, ...extraTo].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];
    await Promise.all(recipients.map((to) => sendEmail({ to, subject, html }).catch(() => {})));
  } catch (err) {
    console.error("[security-event] notify failed:", (err as Error).message);
  }
}
