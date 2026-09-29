import { desc, eq, sql } from "drizzle-orm";
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

  async membersFor(orgId: string): Promise<OrgMember[]> {
    const rows = await this.db
      .select({ name: user.name, email: user.email, role: membership.role, status: membership.status })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.organisationId, orgId));
    return rows as OrgMember[];
  }

  // --- Marketing prospects (platform-owner outreach CRM) -------------------

  async listProspects(): Promise<MarketingProspect[]> {
    return this.db.select().from(marketingProspect).orderBy(desc(marketingProspect.createdAt));
  }

  async prospectById(id: string): Promise<MarketingProspect | null> {
    const rows = await this.db.select().from(marketingProspect).where(eq(marketingProspect.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createProspect(values: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">): Promise<MarketingProspect> {
    const rows = await this.db.insert(marketingProspect).values(values).returning();
    return rows[0]!;
  }

  async insertProspects(rows: Omit<NewMarketingProspect, "id" | "createdAt" | "updatedAt">[]): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted = await this.db.insert(marketingProspect).values(rows).returning({ id: marketingProspect.id });
    return inserted.length;
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
}
