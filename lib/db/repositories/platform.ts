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
  type Organisation,
} from "@/lib/db/schema";

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
}
