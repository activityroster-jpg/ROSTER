import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  organisation,
  membership,
  user,
  instructor,
  course,
  booking,
  courseSession,
  auditLog,
  marketingProspect,
  platformPricing,
  blogPost,
  integration,
  type BlogPost,
  type NewBlogPost,
  type MarketingProspect,
  type NewMarketingProspect,
  type Organisation,
  type PlatformPricing,
  type ProspectStatus,
} from "@/lib/db/schema";
import { DEFAULT_PRICING } from "@/lib/pricing";

export interface OrgUsage {
  instructors: number;
  courses: number;
  bookings: number;
  sessions: number;
}

export interface OrgMember {
  name: string;
  email: string;
  role: string;
  status: string;
}

/**
 * PLATFORM-OWNER cross-tenant repository. Unlike TenantRepository (which is
 * pinned to one org), this deliberately reads across organisations for the
 * super-admin area. It is READ-mostly and must only ever be used behind
 * requirePlatformAdmin(). Org mutations still go through ControlPlaneRepository.
 */
export class PlatformRepository {
  constructor(private readonly db: Database) {}

  async listOrganisations(): Promise<Organisation[]> {
    return this.db.select().from(organisation).orderBy(desc(organisation.createdAt));
  }

  async organisationById(id: string): Promise<Organisation | null> {
    const rows = await this.db.select().from(organisation).where(eq(organisation.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /** Usage counts per organisation, for the admin overview. */
  async usageByOrg(): Promise<Map<string, OrgUsage>> {
    const [ins, crs, bk, ses] = await Promise.all([
      this.db.select({ org: instructor.organisationId, n: sql<number>`count(*)` }).from(instructor).groupBy(instructor.organisationId),
      this.db.select({ org: course.organisationId, n: sql<number>`count(*)` }).from(course).groupBy(course.organisationId),
      this.db.select({ org: booking.organisationId, n: sql<number>`count(*)` }).from(booking).groupBy(booking.organisationId),
      this.db.select({ org: courseSession.organisationId, n: sql<number>`count(*)` }).from(courseSession).groupBy(courseSession.organisationId),
    ]);
    const map = new Map<string, OrgUsage>();
    const ensure = (id: string): OrgUsage => {
      let u = map.get(id);
      if (!u) { u = { instructors: 0, courses: 0, bookings: 0, sessions: 0 }; map.set(id, u); }
      return u;
    };
    for (const r of ins) ensure(r.org).instructors = Number(r.n);
    for (const r of crs) ensure(r.org).courses = Number(r.n);
    for (const r of bk) ensure(r.org).bookings = Number(r.n);
    for (const r of ses) ensure(r.org).sessions = Number(r.n);
    return map;
  }

  /** The signup/owner email per organisation (the earliest admin member). */
  async ownerEmailByOrg(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ org: membership.organisationId, email: user.email, created: membership.createdAt })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.role, "admin"));
    const best = new Map<string, { email: string; created: number }>();
    for (const r of rows) {
      const created = r.created instanceof Date ? r.created.getTime() : Number(r.created ?? 0);
      const cur = best.get(r.org);
      if (!cur || created < cur.created) best.set(r.org, { email: r.email, created });
    }
    const out = new Map<string, string>();
    for (const [org, v] of best) out.set(org, v.email);
    return out;
  }

  async membersFor(orgId: string): Promise<OrgMember[]> {
    const rows = await this.db
      .select({ name: user.name, email: user.email, role: membership.role, status: membership.status })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.organisationId, orgId));
    return rows as OrgMember[];
  }

  // --- Marketing prospects (platform-owner outreach CRM) -------------------

  async listProspects(limit = 100, offset = 0): Promise<MarketingProspect[]> {
    return this.db.select().from(marketingProspect).orderBy(desc(marketingProspect.createdAt)).limit(limit).offset(offset);
  }

  async prospectById(id: string): Promise<MarketingProspect | null> {
    const rows = await this.db.select().from(marketingProspect).where(eq(marketingProspect.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createProspect(values: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">): Promise<MarketingProspect> {
    const rows = await this.db.insert(marketingProspect).values(values).returning();
    return rows[0]!;
  }

  /**
   * Bulk-insert prospects, chunked to stay under Cloudflare D1's hard limit of
   * 100 bound parameters per query. Each row binds ~17 parameters (14 supplied
   * columns + the id/created_at/updated_at generated defaults), so a batch of 5
   * rows (~85 params) is safely inside the ceiling. Without chunking a large
   * paste (e.g. the 400-row RYA directory) would exceed the cap and fail.
   */
  async insertProspects(rows: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">[]): Promise<number> {
    if (rows.length === 0) return 0;
    const CHUNK = 5;
    let total = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const inserted = await this.db.insert(marketingProspect).values(batch).returning({ id: marketingProspect.id });
      total += inserted.length;
    }
    return total;
  }

  /**
   * Idempotent import: skip any incoming row that already exists (matched on
   * name + postcode, case-insensitive) and de-dupe the incoming batch itself, so
   * re-pasting the same CSV — or a superset with a few new centres — never
   * creates duplicates. Returns how many were added vs. skipped.
   */
  async insertProspectsUnique(
    rows: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">[],
  ): Promise<{ inserted: number; skipped: number }> {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    const existing = await this.db
      .select({ name: marketingProspect.name, postcode: marketingProspect.postcode })
      .from(marketingProspect);
    const keyOf = (name: string, postcode: string | null | undefined) =>
      `${name.trim().toLowerCase()}|${(postcode ?? "").trim().toLowerCase()}`;
    const seen = new Set(existing.map((r) => keyOf(r.name, r.postcode)));
    const fresh: typeof rows = [];
    let skipped = 0;
    for (const r of rows) {
      const k = keyOf(r.name, r.postcode);
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k);
      fresh.push(r);
    }
    const inserted = await this.insertProspects(fresh);
    return { inserted, skipped };
  }

  async updateProspect(id: string, patch: Partial<Omit<NewMarketingProspect, "id" | "createdAt">>): Promise<MarketingProspect | null> {
    const rows = await this.db
      .update(marketingProspect)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(marketingProspect.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async setProspectStatus(id: string, status: ProspectStatus): Promise<MarketingProspect | null> {
    return this.updateProspect(id, { status });
  }

  async deleteProspect(id: string): Promise<void> {
    await this.db.delete(marketingProspect).where(eq(marketingProspect.id, id));
  }

  async countProspects(): Promise<number> {
    const rows = await this.db.select({ id: marketingProspect.id }).from(marketingProspect);
    return rows.length;
  }

  // --- Cross-centre change log --------------------------------------------

  /** Recent audit-log entries across ALL centres, with the centre's name. */
  async recentAudit(limit = 200): Promise<{ id: string; org: string; action: string; entity: string; actorUserId: string | null; createdAt: Date }[]> {
    const rows = await this.db
      .select({
        id: auditLog.id,
        org: organisation.name,
        action: auditLog.action,
        entity: auditLog.entity,
        actorUserId: auditLog.actorUserId,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(organisation, eq(organisation.id, auditLog.organisationId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
    return rows;
  }

  // --- Global pricing ------------------------------------------------------

  async getPricing(): Promise<PlatformPricing> {
    const rows = await this.db.select().from(platformPricing).where(eq(platformPricing.id, "default")).limit(1);
    return rows[0] ?? ({ ...DEFAULT_PRICING, updatedAt: new Date() } as PlatformPricing);
  }

  async upsertPricing(patch: Partial<Omit<PlatformPricing, "id" | "updatedAt">>): Promise<void> {
    const updated = await this.db
      .update(platformPricing)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(platformPricing.id, "default"))
      .returning({ id: platformPricing.id });
    if (updated.length === 0) {
      await this.db.insert(platformPricing).values({ ...DEFAULT_PRICING, ...patch, updatedAt: new Date() });
    }
  }

  // --- Blog / CMS ----------------------------------------------------------

  /** Public: published posts whose publishAt has arrived, newest first. */
  async listPublishedPosts(limit = 50, offset = 0): Promise<BlogPost[]> {
    return this.db
      .select()
      .from(blogPost)
      .where(and(eq(blogPost.status, "published"), lte(blogPost.publishAt, new Date())))
      .orderBy(desc(blogPost.publishAt))
      .limit(limit)
      .offset(offset);
  }

  /** Public: count of live posts (for pagination). */
  async countPublishedPosts(): Promise<number> {
    const rows = await this.db
      .select({ id: blogPost.id })
      .from(blogPost)
      .where(and(eq(blogPost.status, "published"), lte(blogPost.publishAt, new Date())));
    return rows.length;
  }

  /** Public: a single live post by slug (or null if missing/not yet live). */
  async getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
    const rows = await this.db
      .select()
      .from(blogPost)
      .where(and(eq(blogPost.slug, slug), eq(blogPost.status, "published"), lte(blogPost.publishAt, new Date())))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Admin: every post (any status), newest scheduled first. */
  async listAllPosts(): Promise<BlogPost[]> {
    return this.db.select().from(blogPost).orderBy(desc(blogPost.publishAt), desc(blogPost.createdAt));
  }

  async getPostById(id: string): Promise<BlogPost | null> {
    const rows = await this.db.select().from(blogPost).where(eq(blogPost.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const rows = await this.db.select().from(blogPost).where(eq(blogPost.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  async createPost(input: NewBlogPost): Promise<BlogPost> {
    const rows = await this.db.insert(blogPost).values(input).returning();
    return rows[0]!;
  }

  async updatePost(id: string, patch: Partial<Omit<BlogPost, "id" | "createdAt">>): Promise<void> {
    await this.db.update(blogPost).set({ ...patch, updatedAt: new Date() }).where(eq(blogPost.id, id));
  }

  async deletePost(id: string): Promise<void> {
    await this.db.delete(blogPost).where(eq(blogPost.id, id));
  }

  async countAllPosts(): Promise<number> {
    const rows = await this.db.select({ id: blogPost.id }).from(blogPost);
    return rows.length;
  }

  // --- Integrations (cross-org, for the scheduled sync job) ----------------

  /** Every auto-sync integration across all centres, with the centre's slug. */
  async listAutoSyncIntegrations(): Promise<{ id: string; organisationId: string; slug: string; provider: string; kind: string; feedUrl: string | null; token: string | null }[]> {
    return this.db
      .select({
        id: integration.id,
        organisationId: integration.organisationId,
        slug: organisation.slug,
        provider: integration.provider,
        kind: integration.kind,
        feedUrl: integration.feedUrl,
        token: integration.token,
      })
      .from(integration)
      .innerJoin(organisation, eq(organisation.id, integration.organisationId))
      .where(and(eq(integration.autoSync, true), eq(integration.status, "connected")));
  }
}
