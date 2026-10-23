"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getDb, getEnv, getRepositories } from "@/lib/cf/bindings";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { CENTRE_COOKIE, CENTRE_COOKIE_MAX_AGE_S, signCentreCookie } from "@/lib/auth/centre-cookie";
import { authSecret } from "@/lib/security/secrets";
import { recordSecurityEvent } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { writeAudit } from "@/lib/services/audit";
import { resolveHost } from "@/lib/tenant/host";
import { idSchema } from "@/lib/validation/actions";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { hashPin, PIN_COOKIE, PIN_IDLE_MAX_AGE_S, PIN_REGEX, pinCookieValue } from "@/lib/auth/pin";

export type JoinResult =
  | { ok: true; status: "joined" | "requested" | "already_requested"; centre: string }
  | { ok: false; error: string };

async function me() {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: new Headers(await headers()) });
  return s?.user ? { id: s.user.id, email: s.user.email.toLowerCase(), name: s.user.name, verified: Boolean(s.user.emailVerified), sessionId: s.session?.id as string | undefined } : null;
}

/**
 * A new account chooses its PIN on the join screen (one screen for the PIN and
 * the centre). Only when the account has none yet: an existing PIN is never
 * replaced here. Sets the verified cookie so the portal opens straight away.
 */
async function choosePinIfNone(user: { id: string; sessionId?: string }, pin: string | undefined): Promise<string | null> {
  if (pin === undefined) return null;
  if (!PIN_REGEX.test(pin)) return "Your PIN must be exactly 4 digits.";
  const { control } = await getRepositories();
  if ((await control.getUserSecurity(user.id))?.pinHash) return null;
  await control.setUserPin(user.id, await hashPin(pin));
  await recordSecurityEvent("pin_set", { userId: user.id });
  if (user.sessionId) {
    const env = getEnv();
    const jar = await cookies();
    jar.set(PIN_COOKIE, await pinCookieValue(authSecret(env), user.sessionId, 30), { httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: PIN_IDLE_MAX_AGE_S });
  }
  return null;
}

/**
 * Remember which centre the app shows (signed; membership is re-checked on every request).
 * Not exported: every export of a "use server" file is an endpoint anyone can call (audit C7).
 */
async function rememberCentre(userId: string, organisationId: string): Promise<void> {
  const env = getEnv();
  const jar = await cookies();
  jar.set(CENTRE_COOKIE, await signCentreCookie(authSecret(env), { organisationId, userId }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", domain: `.${env.APP_APEX_DOMAIN}`, maxAge: CENTRE_COOKIE_MAX_AGE_S,
  });
}

type Me = NonNullable<Awaited<ReturnType<typeof me>>>;

/**
 * Link this login to a centre, or ask to join it.
 *  - If the centre already has an instructor with this (verified) email, the
 *    account is linked and access is immediate.
 *  - Otherwise (company code only) a join request is created: a pending
 *    instructor record plus a "requested" membership, which an admin approves
 *    or declines on the Staff tab. `via` says how they got here, for the log.
 */
async function linkOrRequest(
  user: Me,
  org: { id: string; name: string; slug: string },
  phone: string | undefined,
  via: "company_code" | "staff_list",
): Promise<JoinResult> {
  const { control, tenant } = await getRepositories();
  const repos = await getRepositories();
  const sys: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "app-join" };
  const cleanPhone = (phone ?? "").trim().slice(0, 40) || null;
  if (cleanPhone) await control.setUserPhone(user.id, cleanPhone).catch(() => {});

  const existing = await control.membershipFor(user.id, org.id);
  if (existing?.status === "active") {
    await rememberCentre(user.id, org.id);
    return { ok: true, status: "joined", centre: org.name };
  }
  if (existing?.status === "requested") return { ok: true, status: "already_requested", centre: org.name };

  // Match on the verified email against the centre's instructor records.
  const match = (await tenant.instructor.list(sys))
    .find((i) => (i.email ?? "").toLowerCase() === user.email && i.status !== "pending" && (!i.userId || i.userId === user.id));

  if (match) {
    await tenant.instructor.update(sys, match.id, { userId: user.id, ...(cleanPhone && !match.phone ? { phone: cleanPhone } : {}) });
    if (existing) await control.setMembershipStatus(user.id, org.id, "active");
    else await control.createMembership({ userId: user.id, organisationId: org.id, role: "instructor" }, "active");
    await writeAudit(repos, sys, { action: "app_join", entity: "instructor", entityId: match.id, after: { userId: user.id, via } });
    await recordSecurityEvent("invite_accepted", { userId: user.id, organisationId: org.id, meta: { via } });
    await rememberCentre(user.id, org.id);
    return { ok: true, status: "joined", centre: org.name };
  }

  // Joining by name is only offered while the email is on the list; if it was
  // removed in between, fall back to the code (which can still request to join).
  if (via === "staff_list") {
    return { ok: false, error: `Your email is no longer on ${org.name}'s instructor list. Ask them for their company code instead.` };
  }

  // No match → request to join (the admin decides).
  const pending = await tenant.instructor.insert(sys, {
    userId: user.id,
    name: user.name || user.email,
    email: user.email,
    phone: cleanPhone,
    employmentType: "freelance",
    status: "pending",
  });
  await control.createMembership({ userId: user.id, organisationId: org.id, role: "instructor" }, "requested");
  await writeAudit(repos, sys, { action: "app_join_requested", entity: "instructor", entityId: pending.id, after: { email: user.email } });
  await recordSecurityEvent("join_requested", { userId: user.id, organisationId: org.id });

  // Tell the centre's admins (best effort).
  try {
    const env = getEnv();
    const admins = await control.adminEmailsForOrg(org.id);
    await Promise.all(admins.map((to) => sendEmail({
      to,
      subject: `${user.name || user.email} wants to join ${org.name} on ActivityRoster`,
      html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> (${escapeHtml(user.email)}${cleanPhone ? `, ${escapeHtml(cleanPhone)}` : ""}) entered your company code in the ActivityRoster app and asked to join <strong>${escapeHtml(org.name)}</strong>.</p>
        <p>Approve or decline them under Instructors → Join requests:</p>
        <p><a href="https://${org.slug}.${env.APP_APEX_DOMAIN}/office/staff" style="display:inline-block;background:#0C6B74;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Review join request</a></p>`,
    }).catch(() => {})));
  } catch { /* ignore */ }

  return { ok: true, status: "requested", centre: org.name };
}

/** Join a centre with its company code (the route for anyone not yet on a centre's list). */
export async function joinCentreByCodeAction(code: string, phone?: string, pin?: string): Promise<JoinResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!user.verified) return { ok: false, error: "Please verify your email first." };
  const pinError = await choosePinIfNone(user, pin);
  if (pinError) return { ok: false, error: pinError };

  const limit = await rateLimit(`join-code:${user.id}`, 10, 15 * 60, { failClosed: true });
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const { control } = await getRepositories();
  const org = await control.organisationByJoinCode(code);
  if (!org || org.status !== "active") {
    await recordSecurityEvent("join_code_failed", { userId: user.id, meta: { code: (code ?? "").slice(0, 12) } });
    return { ok: false, error: "That company code isn't right. Check it with your centre and try again." };
  }
  return linkOrRequest(user, org, phone, "company_code");
}

/**
 * Join a centre that already lists this verified email among its instructors:
 * the person picks the centre by name, no company code needed. The admin typing
 * their address on the Instructors list is the invitation; the verified email is
 * the proof. Only centres from {@link centresForMyEmail} are accepted.
 */
export async function joinCentreByNameAction(organisationId: string, phone?: string, pin?: string): Promise<JoinResult> {
  const user = await me();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!user.verified) return { ok: false, error: "Please verify your email first." };
  const pinError = await choosePinIfNone(user, pin);
  if (pinError) return { ok: false, error: pinError };
  const parsed = idSchema.safeParse(organisationId);
  if (!parsed.success) return { ok: false, error: "Choose a centre." };

  const limit = await rateLimit(`join-code:${user.id}`, 10, 15 * 60, { failClosed: true });
  if (!limit.allowed) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const offered = (await centresForMyEmail(user)).find((c) => c.organisationId === parsed.data);
  if (!offered) return { ok: false, error: "That centre doesn't have your email on its instructor list. Ask them for their company code instead." };
  const { control } = await getRepositories();
  const org = await control.organisationById(offered.organisationId);
  if (!org || org.status !== "active") return { ok: false, error: "That centre isn't available right now." };
  return linkOrRequest(user, org, phone, "staff_list");
}

/** Centres whose Instructors list carries this verified email and that the person hasn't joined yet. */
async function centresForMyEmail(user: Me): Promise<{ organisationId: string; name: string }[]> {
  if (!user.verified) return [];
  const platform = new PlatformRepository(await getDb());
  const { control } = await getRepositories();
  const joined = new Set((await control.membershipsForUser(user.id)).filter((m) => m.status === "active").map((m) => m.organisationId));
  return (await platform.centresWithStaffEmail(user.email, user.id))
    .filter((c) => !joined.has(c.organisationId))
    .map((c) => ({ organisationId: c.organisationId, name: c.name }));
}

/** The centres the join screen offers by name (server components only; not a form endpoint). */
export async function centresOfferedByName(): Promise<{ organisationId: string; name: string }[]> {
  const user = await me();
  return user ? centresForMyEmail(user) : [];
}

/** Pick which centre the app shows (must be an active membership), then go to the portal. */
export async function selectCentreAction(organisationId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await me();
  if (!user) return { ok: false, error: "Please sign in again." };
  const { control } = await getRepositories();
  const m = (await control.membershipsForUser(user.id)).find((x) => x.organisationId === organisationId && x.status === "active" && x.orgStatus === "active");
  if (!m) return { ok: false, error: "You don't have access to that centre." };
  await rememberCentre(user.id, organisationId);

  // On the apex (the app) the portal is served right here; on the web, each
  // centre lives on its own subdomain.
  const env = getEnv();
  const host = resolveHost((await headers()).get("host"), env.APP_APEX_DOMAIN);
  redirect(host.kind === "tenant" ? `https://${m.slug}.${env.APP_APEX_DOMAIN}/portal` : "/portal");
}

/** Where the app should send a signed-in user next. */
export async function appLandingAction(): Promise<string> {
  const user = await me();
  if (!user) return "/app";
  const { control } = await getRepositories();
  const ms = await control.membershipsForUser(user.id);
  const active = ms.filter((m) => m.status === "active" && m.orgStatus === "active");
  if (active.length === 1) { await rememberCentre(user.id, active[0]!.organisationId); return "/portal"; }
  if (active.length > 1) return "/app/switch";
  return ms.some((m) => m.status === "requested") ? "/app/join?pending=1" : "/app/join";
}
