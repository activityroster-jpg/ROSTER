import { and, eq, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  membership,
  organisation,
  slugReservation,
  user,
  webhookEvent,
  type MembershipRole,
  type NewOrganisation,
  type Organisation,
} from "@/lib/db/schema";

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

  async createMembership(values: {
    userId: string;
    organisationId: string;
    role: MembershipRole;
  }): Promise<void> {
    await this.db.insert(membership).values({ ...values, status: "active" });
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

  async markWebhookProcessed(stripeEventId: string): Promise<void> {
    await this.db
      .update(webhookEvent)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvent.stripeEventId, stripeEventId));
  }
}
