"use server";

import { headers } from "next/headers";
import { getRepositories } from "@/lib/cf/bindings";
import { rateLimit } from "@/lib/security/rate-limit";
import { maskEmail, maskPhone } from "@/lib/security/phone";

export type TwoFactorHint = { method: "app" | "email" | "sms" | null; hint: string | null };

/**
 * After a correct password, tell the second-step page which method this
 * person chose so it can send the code straight away and word the prompt.
 * Only reveals the method (never the number or address in full) and is
 * rate-limited per network.
 */
export async function twoFactorHintAction(email: string): Promise<TwoFactorHint> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`2fa-hint:${ip}`, 20, 60);
  if (!limit.allowed || typeof email !== "string" || email.length > 200) return { method: null, hint: null };
  const { control } = await getRepositories();
  const user = await control.userByEmail(email.trim().toLowerCase());
  if (!user?.twoFactorEnabled) return { method: null, hint: null };
  const prefs = await control.getTwoFactorPrefs(user.id);
  const method = prefs?.method ?? "app";
  const hint = method === "sms" && prefs?.phone ? maskPhone(prefs.phone) : method === "email" ? maskEmail(user.email) : null;
  return { method, hint };
}
