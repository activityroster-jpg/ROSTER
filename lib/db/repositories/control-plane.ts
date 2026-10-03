import { and, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  account,
  errorReport,
  lead,
  pushToken,
  securityEvent,
  trustedDevice,
  type PushPlatform,
  type SecurityEventKind,
  membership,
  organisation,
  session,
  slugReservation,
  twoFactor,
  user,
  verification,
  webhookEvent,
  type ErrorReport,
  type ErrorReportStatus,
  type LeadOrgType,
  type MembershipRole,
  type MembershipStatus,
  type NewOrganisation,
  type Organisation,
} from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/**
 * Control-plane repository: global (non-tenant) reads/writes for organisations,
 * memberships, the Stripe webhook ledger and slug reservations.
 *
 * These are the ONLY queries allowed to run without a tenant filter, and each
 * is a narrow, purpose-built method — there is no generic unscoped table access.
 * Membership resolution here is what authorises a TenantContext elsewhere.
 */
export class ControlPlaneRepository {
  constructor(private readonly db: Database) {}

  async organisationBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(organisation)
      .where(eq(organisation.slug, slug.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  }

  async organisationById(id: string) {
    const rows = await this.db.select().from(organisation).where(eq(organisation.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createOrganisation(values: NewOrganisation): Promise<Organisation> {
    const rows = await this.db
      .insert(organisation)
      .values({ ...values, slug: values.slug.toLowerCase() })
      .returning();
    return rows[0]!;
  }

  async updateOrganisation(id: string, patch: Partial<NewOrganisation>): Promise<Organisation | null> {
    const rows = await this.db
      .update(organisation)
      .set(patch)
      .where(eq(organisation.id, id))
      .returning();
    return rows[0] ?? null;
  }

  /** Permanently delete an organisation. Cascades to all tenant-owned tables
   *  (ON DELETE CASCADE) — GDPR erasure. */
  async deleteOrganisation(id: string): Promise<void> {
    await this.db.delete(organisation).where(eq(organisation.id, id));
  }

  /** Create an auth user shell (owner) during provisioning. Password/magic link
   *  is set later via Better Auth; this just establishes the identity. */
  async createUser(values: { name: string; email: string }): Promise<{ id: string; email: string }> {
    const rows = await this.db
      .insert(user)
      .values({ name: values.name, email: values.email.toLowerCase(), emailVerified: false })
      .returning({ id: user.id, email: user.email });
    return rows[0]!;
  }

  async userByEmail(email: string) {
    const rows = await this.db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);
    return rows[0] ?? null;
  }

  async userById(id: string) {
    const rows = await this.db.select().from(user).where(eq(user.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /** Mark a user's email verified (used when we provision a trusted owner at
   *  signup so they can sign in immediately without an email round-trip). */
  async markEmailVerified(userId: string): Promise<void> {
    await this.db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
  }

  async createMembership(
    values: { userId: string; organisationId: string; role: MembershipRole },
    status: MembershipStatus = "active",
  ): Promise<void> {
    await this.db.insert(membership).values({ ...values, status });
  }

  /** The membership row (any status) linking a user to an org, or null. */
  async membershipFor(userId: string, organisationId: string): Promise<{ role: MembershipRole; status: MembershipStatus } | null> {
    const rows = await this.db
      .select({ role: membership.role, status: membership.status })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Flip an invited membership to active. Called when the invited user first
   * reaches the centre while signed in — the magic link (or their existing
   * login) has proved they own the invited address. Returns false if there was
   * no pending invite.
   */
  async acceptInvitedMembership(userId: string, organisationId: string): Promise<boolean> {
    const rows = await this.db
      .update(membership)
      .set({ status: "active" })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId), eq(membership.status, "invited")))
      .returning({ id: membership.id });
    return rows.length > 0;
  }

  /** userId → membership status for everyone in an org (Staff tab labels). */
  async membershipStatusByUser(organisationId: string): Promise<Map<string, MembershipStatus>> {
    const rows = await this.db
      .select({ userId: membership.userId, status: membership.status })
      .from(membership)
      .where(eq(membership.organisationId, organisationId));
    return new Map(rows.map((r) => [r.userId, r.status]));
  }

  async organisationByStripeCustomer(stripeCustomerId: string) {
    const rows = await this.db
      .select()
      .from(organisation)
      .where(eq(organisation.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Is this slug already taken by a live organisation? */
  async slugTaken(slug: string): Promise<boolean> {
    return (await this.organisationBySlug(slug)) !== null;
  }

  /**
   * Resolve a user's membership + role within an org. This is the check that
   * authorises tenant access — the subdomain is only a hint until this passes.
   * Returns null when the user is not an active member of the org.
   */
  async activeMembership(
    userId: string,
    organisationId: string,
  ): Promise<{ role: MembershipRole } | null> {
    const rows = await this.db
      .select({ role: membership.role, status: membership.status })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)))
      .limit(1);
    const m = rows[0];
    if (!m || m.status !== "active") return null;
    return { role: m.role };
  }

  /**
   * Remove a login that never got a centre (sign-up provisioning failed after
   * the auth user was created). Only ever called for a user with no membership;
   * refuses otherwise so it can never delete a real member.
   */
  async deleteOrphanUser(userId: string): Promise<boolean> {
    const ms = await this.db.select({ id: membership.id }).from(membership).where(eq(membership.userId, userId)).limit(1);
    if (ms.length) return false;
    const u = await this.userById(userId);
    if (!u) return false;
    await this.db.delete(session).where(eq(session.userId, userId));
    await this.db.delete(account).where(eq(account.userId, userId));
    await this.db.delete(twoFactor).where(eq(twoFactor.userId, userId));
    await this.db.delete(pushToken).where(eq(pushToken.userId, userId));
    await this.db.delete(trustedDevice).where(eq(trustedDevice.userId, userId));
    await this.db.delete(verification).where(eq(verification.identifier, u.email));
    await this.db.delete(user).where(eq(user.id, userId));
    return true;
  }

  // --- Slug soft-reservation (during checkout) -----------------------------

  async reserveSlug(slug: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    // Clear any expired reservation for this slug first.
    await this.db
      .delete(slugReservation)
      .where(and(eq(slugReservation.slug, slug), lt(slugReservation.expiresAt, new Date(now))));
    try {
      await this.db
        .insert(slugReservation)
        .values({ slug, expiresAt: new Date(now + ttlMs) });
      return true;
    } catch {
      return false; // unique constraint => already reserved
    }
  }

  async releaseSlug(slug: string): Promise<void> {
    await this.db.delete(slugReservation).where(eq(slugReservation.slug, slug));
  }

  // --- Stripe webhook idempotency ------------------------------------------

  /**
   * Record that we have seen a Stripe event. Returns true if this is the first
   * time (safe to process), false if it was already recorded (skip). The UNIQUE
   * constraint makes this atomic.
   */
  async recordWebhookEventOnce(stripeEventId: string, type: string, payload?: string): Promise<boolean> {
    try {
      await this.db.insert(webhookEvent).values({ stripeEventId, type, payload });
      return true;
    } catch {
      return false;
    }
  }

  // --- Marketing leads ------------------------------------------------------

  /** Capture a marketing lead, idempotent on email (upsert-ish: ignore dupes). */
  async captureLead(values: {
    email: string;
    centreName?: string | null;
    orgType?: LeadOrgType | null;
    message?: string | null;
    source?: string;
  }): Promise<{ captured: boolean }> {
    try {
      await this.db.insert(lead).values({
        email: values.email.toLowerCase(),
        centreName: values.centreName ?? null,
        orgType: values.orgType ?? null,
        message: values.message ?? null,
        source: values.source ?? "marketing",
      });
      return { captured: true };
    } catch {
      return { captured: false }; // already on the list (unique email)
    }
  }

  // --- Error reports -------------------------------------------------------

  async createErrorReport(values: {
    organisationId?: string | null; organisationSlug?: string | null; userId?: string | null;
    userEmail?: string | null; path?: string | null; message: string; digest?: string | null; userAgent?: string | null;
  }): Promise<ErrorReport> {
    const rows = await this.db.insert(errorReport).values({
      organisationId: values.organisationId ?? null,
      organisationSlug: values.organisationSlug ?? null,
      userId: values.userId ?? null,
      userEmail: values.userEmail ?? null,
      path: values.path ?? null,
      message: values.message.slice(0, 2000),
      digest: values.digest ?? null,
      userAgent: values.userAgent?.slice(0, 500) ?? null,
    }).returning();
    return rows[0]!;
  }

  async listErrorReports(limit = 200): Promise<ErrorReport[]> {
    return this.db.select().from(errorReport).orderBy(desc(errorReport.createdAt)).limit(limit);
  }

  async setErrorReportStatus(id: string, status: ErrorReportStatus): Promise<void> {
    await this.db.update(errorReport).set({ status }).where(eq(errorReport.id, id));
  }

  async markWebhookProcessed(stripeEventId: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvent.stripeEventId, stripeEventId));
  }

  // --- Login PIN (second factor) -------------------------------------------

  async getUserSecurity(userId: string): Promise<{ pinHash: string | null; pinFailedCount: number; pinLockedUntil: Date | null } | null> {
    const rows = await this.db
      .select({ pinHash: user.pinHash, pinFailedCount: user.pinFailedCount, pinLockedUntil: user.pinLockedUntil })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return { pinHash: r.pinHash ?? null, pinFailedCount: r.pinFailedCount ?? 0, pinLockedUntil: r.pinLockedUntil ?? null };
  }

  async setUserPin(userId: string, pinHash: string): Promise<void> {
    await this.db.update(user).set({ pinHash, pinFailedCount: 0, pinLockedUntil: null }).where(eq(user.id, userId));
  }

  /** Clear a user's PIN so they're prompted to set a new one (forgot-PIN flow). */
  async clearUserPin(userId: string): Promise<void> {
    await this.db.update(user).set({ pinHash: null, pinFailedCount: 0, pinLockedUntil: null }).where(eq(user.id, userId));
  }

  async recordPinFailure(userId: string, lockUntil: Date | null): Promise<void> {
    const current = await this.getUserSecurity(userId);
    const count = (current?.pinFailedCount ?? 0) + 1;
    await this.db.update(user).set({ pinFailedCount: count, pinLockedUntil: lockUntil }).where(eq(user.id, userId));
  }

  async resetPinFailures(userId: string): Promise<void> {
    await this.db.update(user).set({ pinFailedCount: 0, pinLockedUntil: null }).where(eq(user.id, userId));
  }

  /** Set (or clear) a user's account-recovery email. */
  async setRecoveryEmail(userId: string, recoveryEmail: string | null): Promise<void> {
    await this.db.update(user).set({ recoveryEmail }).where(eq(user.id, userId));
  }

  // --- Account security -----------------------------------------------------

  /** True when the user signs in with a password (vs magic link only). */
  async hasCredentialPassword(userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);
    return Boolean(rows[0]?.password);
  }

  async logSecurityEvent(input: {
    userId: string;
    organisationId?: string | null;
    kind: SecurityEventKind;
    ip?: string | null;
    userAgent?: string | null;
    country?: string | null;
    meta?: string | null;
  }): Promise<void> {
    await this.db.insert(securityEvent).values({
      userId: input.userId,
      organisationId: input.organisationId ?? null,
      kind: input.kind,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      country: input.country ?? null,
      meta: input.meta ?? null,
    });
  }

  /** A user's own recent security events, newest first. */
  async listSecurityEvents(userId: string, limit = 20) {
    return this.db
      .select()
      .from(securityEvent)
      .where(eq(securityEvent.userId, userId))
      .orderBy(desc(securityEvent.createdAt))
      .limit(limit);
  }

  // --- Trusted devices (unfamiliar-device re-auth) ---------------------------

  /**
   * Is this user × device already confirmed from this country? The IP is
   * recorded but NOT part of the match: phones change address constantly and
   * an attacker with a stolen session needs the password either way. Bumps
   * last-seen on the matching row.
   */
  async isTrustedDevice(userId: string, deviceId: string, _ip: string, country: string | null): Promise<boolean> {
    void _ip;
    const rows = await this.db
      .select({ id: trustedDevice.id, country: trustedDevice.country })
      .from(trustedDevice)
      .where(and(eq(trustedDevice.userId, userId), eq(trustedDevice.deviceId, deviceId)));
    const row = rows.find((r) => (r.country ?? null) === (country ?? null));
    if (!row) return false;
    await this.db.update(trustedDevice).set({ lastSeenAt: new Date() }).where(eq(trustedDevice.id, row.id));
    return true;
  }

  async countTrustedDevices(userId: string): Promise<number> {
    const rows = await this.db.select({ id: trustedDevice.id }).from(trustedDevice).where(eq(trustedDevice.userId, userId));
    return rows.length;
  }

  /** Record (or refresh) a confirmed device × IP for the user. */
  async trustDevice(input: { userId: string; deviceId: string; ip: string; country: string | null; userAgent: string | null }): Promise<void> {
    await this.db
      .insert(trustedDevice)
      .values({ ...input, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: [trustedDevice.userId, trustedDevice.deviceId, trustedDevice.ip],
        set: { country: input.country, userAgent: input.userAgent, lastSeenAt: new Date() },
      });
  }

  /** The user's confirmed devices, most recent first (one row per device × IP). */
  async listTrustedDevices(userId: string, limit = 20) {
    return this.db
      .select()
      .from(trustedDevice)
      .where(eq(trustedDevice.userId, userId))
      .orderBy(desc(trustedDevice.lastSeenAt))
      .limit(limit);
  }

  /** Forget every device: the next request from anywhere asks for the password again. */
  async forgetTrustedDevices(userId: string): Promise<number> {
    const rows = await this.db.delete(trustedDevice).where(eq(trustedDevice.userId, userId)).returning({ id: trustedDevice.id });
    return rows.length;
  }

  /** Ghost Mode visits to one centre (owner-side log), newest first. */
  async listGhostVisits(organisationId: string, limit = 10) {
    const rows = await this.db
      .select({ id: securityEvent.id, kind: securityEvent.kind, userId: securityEvent.userId, createdAt: securityEvent.createdAt })
      .from(securityEvent)
      .where(and(eq(securityEvent.organisationId, organisationId), inArray(securityEvent.kind, ["ghost_start", "ghost_end"])))
      .orderBy(desc(securityEvent.createdAt))
      .limit(limit);
    return rows;
  }

  // --- Company codes & app membership -------------------------------------

  async organisationByJoinCode(code: string) {
    const clean = normaliseJoinCode(code);
    if (!clean) return null;
    const rows = await this.db.select().from(organisation).where(eq(organisation.joinCode, clean)).limit(1);
    return rows[0] ?? null;
  }

  /** The centre's company code, generating one the first time it's asked for. */
  async ensureJoinCode(organisationId: string): Promise<string> {
    const org = await this.organisationById(organisationId);
    if (!org) throw new Error("Organisation not found");
    if (org.joinCode) return org.joinCode;
    return this.regenerateJoinCode(organisationId);
  }

  /** Issue a fresh company code (the old one stops working immediately). */
  async regenerateJoinCode(organisationId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode();
      if (await this.organisationByJoinCode(code)) continue; // astronomically rare collision
      await this.db.update(organisation).set({ joinCode: code }).where(eq(organisation.id, organisationId));
      return code;
    }
    throw new Error("Could not generate a unique company code");
  }

  /** Every centre a user belongs to (any status), with the centre's name/slug. */
  async membershipsForUser(userId: string): Promise<{ organisationId: string; name: string; slug: string; role: MembershipRole; status: MembershipStatus; orgStatus: string }[]> {
    return this.db
      .select({ organisationId: membership.organisationId, name: organisation.name, slug: organisation.slug, role: membership.role, status: membership.status, orgStatus: organisation.status })
      .from(membership)
      .innerJoin(organisation, eq(organisation.id, membership.organisationId))
      .where(eq(membership.userId, userId));
  }

  async setMembershipStatus(userId: string, organisationId: string, status: MembershipStatus): Promise<boolean> {
    const rows = await this.db
      .update(membership)
      .set({ status })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)))
      .returning({ id: membership.id });
    return rows.length > 0;
  }

  async deleteMembership(userId: string, organisationId: string): Promise<void> {
    await this.db.delete(membership).where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)));
  }

  /** Emails of a centre's active admins (to tell them about a join request). */
  async adminEmailsForOrg(organisationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ email: user.email })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.organisationId, organisationId), eq(membership.role, "admin"), eq(membership.status, "active")));
    return rows.map((r) => r.email);
  }

  async setUserPhone(userId: string, phone: string | null): Promise<void> {
    await this.db.update(user).set({ phone }).where(eq(user.id, userId));
  }

  // --- Push tokens -----------------------------------------------------------

  /** Register (or refresh) a device's push token for the user. A token moving to another user is re-owned. */
  async upsertPushToken(input: { userId: string; token: string; platform: PushPlatform; deviceId: string | null }): Promise<void> {
    await this.db
      .insert(pushToken)
      .values({ ...input, lastSeenAt: new Date() })
      .onConflictDoUpdate({ target: pushToken.token, set: { userId: input.userId, platform: input.platform, deviceId: input.deviceId, lastSeenAt: new Date() } });
  }

  async deletePushToken(token: string): Promise<void> {
    await this.db.delete(pushToken).where(eq(pushToken.token, token));
  }

  async pushTokensForUser(userId: string): Promise<{ token: string; platform: PushPlatform }[]> {
    return this.db.select({ token: pushToken.token, platform: pushToken.platform }).from(pushToken).where(eq(pushToken.userId, userId));
  }
}

/** Company codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L). */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
/** Uppercase, strip spaces/dashes; null if it can't be a code. */
export function normaliseJoinCode(input: string): string | null {
  const clean = (input ?? "").toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z0-9]{6}$/.test(clean) ? clean : null;
}
