import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { paramChunks } from "@/lib/db/params";
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
  type TwoFactorMethod,
  type NewOrganisation,
  type Organisation,
  rateLimitBucket,
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

  async sessionById(id: string) {
    const rows = await this.db.select().from(session).where(eq(session.id, id)).limit(1);
    return rows[0] ?? null;
  }
  /** End one session (e.g. an office session idle for 12 hours). The cookie the browser still holds stops working. */
  async deleteSessionById(id: string): Promise<void> {
    await this.db.delete(session).where(eq(session.id, id));
  }
  /** "Log out all devices": end every session of a user except the one they are using now. Returns how many ended. */
  async deleteOtherSessions(userId: string, keepSessionId: string | null): Promise<number> {
    const rows = await this.db.select({ id: session.id }).from(session).where(eq(session.userId, userId));
    const victims = rows.map((r) => r.id).filter((id) => id !== keepSessionId);
    for (const chunk of paramChunks(victims)) await this.db.delete(session).where(inArray(session.id, chunk));
    return victims.length;
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
    values: { userId: string; organisationId: string; role: MembershipRole; features?: readonly string[] },
    status: MembershipStatus = "active",
  ): Promise<void> {
    const { features, ...rest } = values;
    await this.db.insert(membership).values({ ...rest, status, features: JSON.stringify(features ?? []) });
  }
  /** The owner's choice of office features for an office admin. */
  async setMembershipFeatures(userId: string, organisationId: string, features: readonly string[]): Promise<boolean> {
    const rows = await this.db.update(membership).set({ features: JSON.stringify(features), updatedAt: new Date() })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId), eq(membership.role, "admin"))).returning({ id: membership.id });
    return rows.length > 0;
  }
  /** Last sign-in and open sessions per user, for the office security list. */
  async sessionSummaries(userIds: string[]): Promise<Map<string, { lastSeen: Date | null; active: number }>> {
    const out = new Map<string, { lastSeen: Date | null; active: number }>();
    if (userIds.length === 0) return out;
    const rows = [];
    for (const chunk of paramChunks(userIds)) {
      rows.push(...(await this.db.select({ userId: session.userId, updatedAt: session.updatedAt, expiresAt: session.expiresAt }).from(session).where(inArray(session.userId, chunk))));
    }
    const now = Date.now();
    for (const id of userIds) out.set(id, { lastSeen: null, active: 0 });
    for (const r of rows) {
      const cur = out.get(r.userId)!;
      if (!cur.lastSeen || r.updatedAt > cur.lastSeen) cur.lastSeen = r.updatedAt;
      if (r.expiresAt.getTime() > now) cur.active++;
    }
    return out;
  }
  /** Everyone who can open a centre's office (owner and office admins), with their account details. */
  async officeMembersForOrg(organisationId: string): Promise<{ userId: string; name: string; email: string; role: MembershipRole; status: MembershipStatus; features: string; createdAt: Date }[]> {
    return this.db
      .select({ userId: membership.userId, name: user.name, email: user.email, role: membership.role, status: membership.status, features: membership.features, createdAt: membership.createdAt })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.organisationId, organisationId), inArray(membership.role, ["owner", "admin"])));
  }
  /** Hand the superadmin role to another office user; the previous owner becomes an office admin with every feature. Dev Center only. */
  async transferOwnership(organisationId: string, fromUserId: string, toUserId: string): Promise<void> {
    const all = JSON.stringify(["roster", "staff", "protected", "payroll", "settings", "billing", "exports"]);
    await this.db.update(membership).set({ role: "admin", features: all, updatedAt: new Date() }).where(and(eq(membership.userId, fromUserId), eq(membership.organisationId, organisationId), eq(membership.role, "owner")));
    await this.db.update(membership).set({ role: "owner", features: all, status: "active", updatedAt: new Date() }).where(and(eq(membership.userId, toUserId), eq(membership.organisationId, organisationId)));
  }

  /** The membership row (any status) linking a user to an org, or null. */
  async membershipFor(userId: string, organisationId: string): Promise<{ role: MembershipRole; status: MembershipStatus; features: string } | null> {
    const rows = await this.db
      .select({ role: membership.role, status: membership.status, features: membership.features })
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

  /** An invitation email went out (or was re-sent): start the one-day reminder clock again. */
  async noteInviteSent(userId: string, organisationId: string, invitedByName: string | null): Promise<void> {
    // A queued invite sent later by the tick has no inviter in hand: keep the name recorded when it was queued.
    await this.db.update(membership).set({ inviteSentAt: new Date(), inviteRemindedAt: null, inviteQueuedAt: null, ...(invitedByName ? { invitedByName } : {}), updatedAt: new Date() })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)));
  }

  /** The centre's daily invite cap held this invitation back: remember it for the next day. */
  async queueInvite(userId: string, organisationId: string, invitedByName: string | null): Promise<void> {
    await this.db.update(membership).set({ inviteQueuedAt: new Date(), ...(invitedByName ? { invitedByName } : {}), updatedAt: new Date() })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId), isNull(membership.inviteQueuedAt)));
  }

  /** Invitations waiting on a daily cap, oldest first, at active centres and still unanswered. */
  async queuedInvites(limit = 500): Promise<{ userId: string; organisationId: string; email: string; role: MembershipRole; invitedByName: string | null; centreName: string; slug: string }[]> {
    return this.db
      .select({ userId: membership.userId, organisationId: membership.organisationId, email: user.email, role: membership.role, invitedByName: membership.invitedByName, centreName: organisation.name, slug: organisation.slug })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .innerJoin(organisation, eq(organisation.id, membership.organisationId))
      .where(and(
        eq(membership.status, "invited"),
        inArray(membership.role, ["instructor", "admin"]),
        isNotNull(membership.inviteQueuedAt),
        eq(organisation.status, "active"),
      ))
      .orderBy(membership.inviteQueuedAt)
      .limit(limit);
  }

  /** userIds whose invitation is waiting for tomorrow, for the staff list label. */
  async inviteQueuedUsers(organisationId: string): Promise<Set<string>> {
    const rows = await this.db.select({ userId: membership.userId }).from(membership)
      .where(and(eq(membership.organisationId, organisationId), isNotNull(membership.inviteQueuedAt), eq(membership.status, "invited")));
    return new Set(rows.map((r) => r.userId));
  }

  /** Invitations still unanswered after `olderThan`, never reminded, at active centres: the one reminder is due. */
  async invitesDueReminder(olderThan: Date, limit = 100): Promise<{ userId: string; organisationId: string; email: string; role: MembershipRole; invitedByName: string | null; centreName: string; slug: string }[]> {
    return this.db
      .select({ userId: membership.userId, organisationId: membership.organisationId, email: user.email, role: membership.role, invitedByName: membership.invitedByName, centreName: organisation.name, slug: organisation.slug })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .innerJoin(organisation, eq(organisation.id, membership.organisationId))
      .where(and(
        eq(membership.status, "invited"),
        inArray(membership.role, ["instructor", "admin"]),
        isNotNull(membership.inviteSentAt),
        lt(membership.inviteSentAt, olderThan),
        isNull(membership.inviteRemindedAt),
        eq(organisation.status, "active"),
      ))
      .limit(limit);
  }

  async markInviteReminded(userId: string, organisationId: string): Promise<void> {
    await this.db.update(membership).set({ inviteRemindedAt: new Date() })
      .where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)));
  }

  /** userId → when their invitation went out, for "invited 3 days ago" on the staff list. */
  async inviteSentByUser(organisationId: string): Promise<Map<string, Date>> {
    const rows = await this.db.select({ userId: membership.userId, at: membership.inviteSentAt }).from(membership)
      .where(and(eq(membership.organisationId, organisationId), isNotNull(membership.inviteSentAt)));
    return new Map(rows.filter((r) => r.at).map((r) => [r.userId, r.at as Date]));
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

  /**
   * True when the same message was already logged for the same path recently.
   * Keeps one line per distinct browser CSP report instead of one per page load.
   */
  async hasRecentErrorReport(message: string, path: string | null, withinMs: number): Promise<boolean> {
    const since = new Date(Date.now() - withinMs);
    const rows = await this.db
      .select({ id: errorReport.id })
      .from(errorReport)
      .where(and(eq(errorReport.message, message.slice(0, 2000)), path == null ? isNull(errorReport.path) : eq(errorReport.path, path), gte(errorReport.createdAt, since)))
      .limit(1);
    return rows.length > 0;
  }

  /** Resolve every open report with this reference (e.g. all browser CSP reports) in one go. Returns how many changed. */
  async resolveErrorReportsByDigest(digest: string): Promise<number> {
    const rows = await this.db
      .update(errorReport)
      .set({ status: "resolved" })
      .where(and(eq(errorReport.digest, digest), ne(errorReport.status, "resolved")))
      .returning({ id: errorReport.id });
    return rows.length;
  }

  async markWebhookProcessed(stripeEventId: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvent.stripeEventId, stripeEventId));
  }

  // --- Login PIN (second factor) -------------------------------------------

  /**
   * Count one hit against a fixed-window limit and return the count in this
   * window. One statement: insert, or bump within the same window, or restart
   * at 1 when the window has moved on. Atomic because D1 serialises writes.
   */
  async hitRateLimit(key: string, window: number, expiresAt: Date): Promise<number> {
    const rows = await this.db
      .insert(rateLimitBucket)
      .values({ key, window, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitBucket.key,
        set: {
          count: sql`CASE WHEN ${rateLimitBucket.window} = ${window} THEN ${rateLimitBucket.count} + 1 ELSE 1 END`,
          window: sql`${window}`,
          expiresAt: sql`${expiresAt.getTime()}`,
        },
      })
      .returning({ count: rateLimitBucket.count });
    return rows[0]?.count ?? 1;
  }

  /** Drop counters whose window is over (run from the hourly tick). */
  async purgeRateLimits(now: Date = new Date()): Promise<number> {
    const removed = await this.db.delete(rateLimitBucket).where(lt(rateLimitBucket.expiresAt, now)).returning({ key: rateLimitBucket.key });
    return removed.length;
  }

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

  /** Which second step a user chose (authenticator app or emailed code). */
  async getTwoFactorPrefs(userId: string): Promise<{ enabled: boolean; method: TwoFactorMethod | null } | null> {
    const rows = await this.db
      .select({ enabled: user.twoFactorEnabled, method: user.twoFactorMethod })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return { enabled: Boolean(r.enabled), method: r.method ?? null };
  }

  async setTwoFactorPrefs(userId: string, method: TwoFactorMethod | null): Promise<void> {
    await this.db.update(user).set({ twoFactorMethod: method }).where(eq(user.id, userId));
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
  /** Known device in a known country; with `strict` (office users) the city must match too. A row with no city recorded (older) still counts. */
  async isTrustedDevice(userId: string, deviceId: string, _ip: string, country: string | null, city: string | null = null, strict = false): Promise<boolean> {
    void _ip;
    const rows = await this.db
      .select({ id: trustedDevice.id, country: trustedDevice.country, city: trustedDevice.city })
      .from(trustedDevice)
      .where(and(eq(trustedDevice.userId, userId), eq(trustedDevice.deviceId, deviceId)));
    const row = rows.find((r) => (r.country ?? null) === (country ?? null) && (!strict || !city || !r.city || r.city === city));
    if (!row) return false;
    await this.db.update(trustedDevice).set({ lastSeenAt: new Date() }).where(eq(trustedDevice.id, row.id));
    return true;
  }

  async countTrustedDevices(userId: string): Promise<number> {
    const rows = await this.db.select({ id: trustedDevice.id }).from(trustedDevice).where(eq(trustedDevice.userId, userId));
    return rows.length;
  }

  /** Record (or refresh) a confirmed device × IP for the user. */
  async trustDevice(input: { userId: string; deviceId: string; ip: string; country: string | null; city?: string | null; userAgent: string | null }): Promise<void> {
    await this.db
      .insert(trustedDevice)
      .values({ ...input, city: input.city ?? null, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: [trustedDevice.userId, trustedDevice.deviceId, trustedDevice.ip],
        set: { country: input.country, city: input.city ?? null, userAgent: input.userAgent, lastSeenAt: new Date() },
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
  /** Platform retention (docs/retention.md): old security events and trusted devices go after 12 months. */
  async purgeSecurityData(cutoff: Date): Promise<{ events: number; devices: number }> {
    const ev = await this.db.delete(securityEvent).where(lt(securityEvent.createdAt, cutoff)).returning({ id: securityEvent.id });
    const dv = await this.db.delete(trustedDevice).where(lt(trustedDevice.lastSeenAt, cutoff)).returning({ id: trustedDevice.id });
    return { events: ev.length, devices: dv.length };
  }

  /** Sign-in and account events for a centre's members, for the centre's own change log. */
  async listSecurityEventsForOrg(organisationId: string, limit = 200) {
    return this.db
      .select({ id: securityEvent.id, kind: securityEvent.kind, userId: securityEvent.userId, country: securityEvent.country, createdAt: securityEvent.createdAt })
      .from(securityEvent)
      .where(eq(securityEvent.organisationId, organisationId))
      .orderBy(desc(securityEvent.createdAt))
      .limit(limit);
  }

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

  /** Change a member's role in one centre (Staff → Access). */
  async setMembershipRole(userId: string, organisationId: string, role: MembershipRole): Promise<boolean> {
    const rows = await this.db.update(membership).set({ role, updatedAt: new Date() }).where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId))).returning({ id: membership.id });
    return rows.length > 0;
  }

  async deleteMembership(userId: string, organisationId: string): Promise<void> {
    await this.db.delete(membership).where(and(eq(membership.userId, userId), eq(membership.organisationId, organisationId)));
  }

  /** Emails of a centre's active admins (to tell them about a join request). */
  /** Every login with a membership in this centre (any role or status), for removing a test centre. */
  async memberUsers(organisationId: string): Promise<{ userId: string; email: string }[]> {
    return this.db.select({ userId: membership.userId, email: user.email }).from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.organisationId, organisationId));
  }

  async adminEmailsForOrg(organisationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ email: user.email })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.organisationId, organisationId), inArray(membership.role, ["owner", "admin"]), eq(membership.status, "active")));
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
