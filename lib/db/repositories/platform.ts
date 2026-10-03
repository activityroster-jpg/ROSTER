import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
  platformTask,
  financeTransaction,
  financeSettings,
  outreachCampaign,
  outreachLead,
  outreachMessage,
  outreachSuppression,
  aiUsage,
  callAvailability,
  callBooking,
  type CallAvailability,
  type NewCallAvailability,
  type CallBooking,
  type NewCallBooking,
  type CallBookingStatus,
  type BlogPost,
  type NewBlogPost,
  type MarketingProspect,
  type NewMarketingProspect,
  type Organisation,
  type PlatformPricing,
  type PlatformTask,
  type NewPlatformTask,
  type FinanceTransaction,
  type NewFinanceTransaction,
  type FinanceSettings,
  type OutreachCampaign,
  type NewOutreachCampaign,
  type OutreachLead,
  type NewOutreachLead,
  type OutreachMessage,
  type OutreachSuppression,
  type AiUsage,
  type NewAiUsage,
  type OutreachLeadStatus,
  type SuppressionReason,
  type TaskStatus,
  type ProspectStatus,
} from "@/lib/db/schema";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { parseProspectStatuses, primaryProspectStatus, prospectStatusRank } from "@/lib/marketing";

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

  /** When each centre last did anything (latest audit-log entry), for the overview. */
  async lastActivityByOrg(): Promise<Map<string, Date>> {
    const rows = await this.db
      .select({ org: auditLog.organisationId, last: sql<number>`max(${auditLog.createdAt})` })
      .from(auditLog)
      .groupBy(auditLog.organisationId);
    const out = new Map<string, Date>();
    for (const r of rows) if (r.last != null) out.set(r.org, new Date(Number(r.last)));
    return out;
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
    const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, "");
    // A row is a duplicate when the name matches and the postcodes agree — or
    // either side has no postcode (older rows were often imported without one).
    const byName = new Map<string, Set<string>>();
    for (const r of existing) {
      const n = norm(r.name);
      if (!byName.has(n)) byName.set(n, new Set());
      byName.get(n)!.add(norm(r.postcode));
    }
    const isDupe = (name: string, postcode: string | null | undefined) => {
      const codes = byName.get(norm(name));
      if (!codes) return false;
      const pc = norm(postcode);
      return pc === "" || codes.has("") || codes.has(pc);
    };
    const fresh: typeof rows = [];
    let skipped = 0;
    for (const r of rows) {
      if (isDupe(r.name, r.postcode)) { skipped++; continue; }
      const n = norm(r.name);
      if (!byName.has(n)) byName.set(n, new Set());
      byName.get(n)!.add(norm(r.postcode));
      fresh.push(r);
    }
    const inserted = await this.insertProspects(fresh);
    return { inserted, skipped };
  }

  /**
   * Collapse duplicate prospects (same rule as the import: name matches and the
   * postcodes agree or one is missing). The row furthest along the outreach
   * pipeline is kept — ties go to the one with notes, then the oldest — and it
   * inherits the union of the others' touchpoints and any notes they had.
   */
  async dedupeProspects(): Promise<{ removed: number; groups: number }> {
    const rows = await this.db.select().from(marketingProspect).orderBy(asc(marketingProspect.createdAt));
    const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const byName = new Map<string, MarketingProspect[]>();
    for (const r of rows) {
      const n = norm(r.name);
      if (!n) continue;
      byName.set(n, [...(byName.get(n) ?? []), r]);
    }
    let removed = 0;
    let groups = 0;
    for (const same of byName.values()) {
      if (same.length < 2) continue;
      // Split a name group into postcode clusters. Rows with a postcode are
      // placed first (equal postcodes share a cluster); rows without one then
      // join the first cluster, so a blank never bridges two different places.
      const clusters: MarketingProspect[][] = [];
      const ordered = [...same].sort((a, b) => Number(norm(a.postcode) === "") - Number(norm(b.postcode) === ""));
      for (const r of ordered) {
        const pc = norm(r.postcode);
        const hit = pc === ""
          ? clusters[0]
          : clusters.find((c) => c.some((x) => norm(x.postcode) === pc));
        if (hit) hit.push(r); else clusters.push([r]);
      }
      for (const c of clusters) {
        if (c.length < 2) continue;
        groups++;
        const score = (r: MarketingProspect) => prospectStatusRank(parseProspectStatuses(r.statuses, r.status)) * 10 + (r.notes ? 1 : 0);
        const keeper = [...c].sort((a, b) => score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime())[0]!;
        const others = c.filter((r) => r.id !== keeper.id);
        const statuses = [...new Set(c.flatMap((r) => parseProspectStatuses(r.statuses, r.status)))];
        const notes = [...new Set(c.map((r) => (r.notes ?? "").trim()).filter(Boolean))].join("\n");
        const fill = <K extends keyof MarketingProspect>(k: K) => keeper[k] ?? others.map((o) => o[k]).find((v) => v != null && v !== "") ?? keeper[k];
        await this.updateProspect(keeper.id, {
          statuses: JSON.stringify(statuses),
          status: primaryProspectStatus(statuses),
          notes: notes || null,
          email: fill("email"), website: fill("website"), linkedinUrl: fill("linkedinUrl"), contactName: fill("contactName"), contactRole: fill("contactRole"),
          addressLine1: fill("addressLine1"), addressLine2: fill("addressLine2"), city: fill("city"), postcode: fill("postcode"), region: fill("region"),
        });
        for (const o of others) { await this.deleteProspect(o.id); removed++; }
      }
    }
    return { removed, groups };
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

  /** Set the multi-select outreach statuses; keeps the single `status` column in sync as the primary. */
  async setProspectStatuses(id: string, statuses: ProspectStatus[], primary: ProspectStatus): Promise<MarketingProspect | null> {
    return this.updateProspect(id, { statuses: JSON.stringify(statuses), status: primary });
  }

  /**
   * Add or remove one outreach status on every prospect whose name matches one
   * of the given names (case- and whitespace-insensitive). Used by the
   * "Bulk status by name" tool so a pasted list of centres can be corrected in
   * one go (e.g. "these letters were not actually sent"). Returns which names
   * matched nothing so the caller can show them.
   */
  async bulkProspectStatusByName(
    names: string[],
    status: ProspectStatus,
    mode: "add" | "remove",
  ): Promise<{ matched: number; updated: number; unmatched: string[] }> {
    const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const wanted = new Map<string, string>();
    for (const n of names) { const k = norm(n); if (k) wanted.set(k, n.trim()); }
    if (wanted.size === 0) return { matched: 0, updated: 0, unmatched: [] };
    const rows = await this.db
      .select({ id: marketingProspect.id, name: marketingProspect.name, status: marketingProspect.status, statuses: marketingProspect.statuses })
      .from(marketingProspect);
    const seen = new Set<string>();
    let matched = 0;
    let updated = 0;
    for (const r of rows) {
      const k = norm(r.name);
      if (!wanted.has(k)) continue;
      matched++;
      seen.add(k);
      const current = parseProspectStatuses(r.statuses, r.status);
      let next: ProspectStatus[];
      if (mode === "add") {
        if (current.includes(status)) continue;
        next = [...current.filter((s) => s !== "new"), status];
      } else {
        if (!current.includes(status)) continue;
        next = current.filter((s) => s !== status);
        if (next.length === 0) next = ["new"];
      }
      await this.setProspectStatuses(r.id, next, primaryProspectStatus(next));
      updated++;
    }
    const unmatched = [...wanted.entries()].filter(([k]) => !seen.has(k)).map(([, original]) => original);
    return { matched, updated, unmatched };
  }

  async deleteProspect(id: string): Promise<void> {
    await this.db.delete(marketingProspect).where(eq(marketingProspect.id, id));
  }

  async countProspects(): Promise<number> {
    const rows = await this.db.select({ id: marketingProspect.id }).from(marketingProspect);
    return rows.length;
  }

  // --- Discovery-call scheduling ------------------------------------------

  async listAvailability(): Promise<CallAvailability[]> {
    return this.db.select().from(callAvailability).orderBy(asc(callAvailability.dayOfWeek), asc(callAvailability.startMinute));
  }

  async addAvailability(w: Omit<NewCallAvailability, "id" | "createdAt" | "updatedAt">): Promise<CallAvailability> {
    const rows = await this.db.insert(callAvailability).values(w).returning();
    return rows[0]!;
  }

  async deleteAvailability(id: string): Promise<void> {
    await this.db.delete(callAvailability).where(eq(callAvailability.id, id));
  }

  /** Booked (non-cancelled) call start times from `from` onward — used to remove taken slots. */
  async bookedSlotsFrom(from: Date): Promise<Date[]> {
    const rows = await this.db
      .select({ startAt: callBooking.startAt, status: callBooking.status })
      .from(callBooking)
      .where(gte(callBooking.startAt, from));
    return rows.filter((r) => r.status !== "cancelled").map((r) => r.startAt);
  }

  /** Is this exact slot still free? (guards against a double-booking race) */
  async isSlotFree(startAt: Date): Promise<boolean> {
    const rows = await this.db
      .select({ id: callBooking.id, status: callBooking.status })
      .from(callBooking)
      .where(eq(callBooking.startAt, startAt));
    return rows.every((r) => r.status === "cancelled");
  }

  async createBooking(b: Omit<NewCallBooking, "id" | "createdAt">): Promise<CallBooking> {
    const rows = await this.db.insert(callBooking).values(b).returning();
    return rows[0]!;
  }

  async listBookings(from?: Date): Promise<CallBooking[]> {
    const base = this.db.select().from(callBooking);
    const rows = from
      ? await base.where(gte(callBooking.startAt, from)).orderBy(asc(callBooking.startAt))
      : await base.orderBy(asc(callBooking.startAt));
    return rows;
  }

  async setBookingStatus(id: string, status: CallBookingStatus): Promise<CallBooking | null> {
    const rows = await this.db.update(callBooking).set({ status }).where(eq(callBooking.id, id)).returning();
    return rows[0] ?? null;
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

  // --- Finance (owner's books) ----------------------------------------------

  async listFinanceTransactions(range?: { from?: string; to?: string }): Promise<FinanceTransaction[]> {
    const conds = [];
    if (range?.from) conds.push(gte(financeTransaction.date, range.from));
    if (range?.to) conds.push(lte(financeTransaction.date, range.to));
    const base = this.db.select().from(financeTransaction);
    const rows = conds.length ? await base.where(and(...conds)).orderBy(desc(financeTransaction.date), desc(financeTransaction.createdAt)) : await base.orderBy(desc(financeTransaction.date), desc(financeTransaction.createdAt));
    return rows;
  }

  async insertFinanceTransaction(values: Omit<NewFinanceTransaction, "id" | "createdAt" | "updatedAt">): Promise<FinanceTransaction> {
    const rows = await this.db.insert(financeTransaction).values(values).returning();
    return rows[0]!;
  }

  /** Insert unless a row with this external id exists (Stripe idempotency). Returns the row and whether it was new. */
  async upsertFinanceByExternalId(values: Omit<NewFinanceTransaction, "id" | "createdAt" | "updatedAt"> & { externalId: string }): Promise<{ row: FinanceTransaction; created: boolean }> {
    const existing = await this.db.select().from(financeTransaction).where(eq(financeTransaction.externalId, values.externalId)).limit(1);
    if (existing[0]) return { row: existing[0], created: false };
    const rows = await this.db.insert(financeTransaction).values(values).returning();
    return { row: rows[0]!, created: true };
  }

  async updateFinanceTransaction(id: string, patch: Partial<Omit<NewFinanceTransaction, "id" | "createdAt">>): Promise<FinanceTransaction | null> {
    const rows = await this.db.update(financeTransaction).set({ ...patch, updatedAt: new Date() }).where(eq(financeTransaction.id, id)).returning();
    return rows[0] ?? null;
  }

  async deleteFinanceTransaction(id: string): Promise<boolean> {
    const rows = await this.db.delete(financeTransaction).where(eq(financeTransaction.id, id)).returning({ id: financeTransaction.id });
    return rows.length > 0;
  }

  async getFinanceSettings(): Promise<FinanceSettings> {
    const rows = await this.db.select().from(financeSettings).where(eq(financeSettings.id, "default")).limit(1);
    return rows[0] ?? { id: "default", fyStartMonth: 1, reportingCurrency: "GBP", eurToGbp: 0.86, openingCashMinor: 0, openingCashDate: null, updatedAt: new Date() };
  }

  async upsertFinanceSettings(patch: Partial<Omit<FinanceSettings, "id" | "updatedAt">>): Promise<void> {
    const updated = await this.db.update(financeSettings).set({ ...patch, updatedAt: new Date() }).where(eq(financeSettings.id, "default")).returning({ id: financeSettings.id });
    if (updated.length === 0) await this.db.insert(financeSettings).values({ id: "default", ...patch, updatedAt: new Date() });
  }

  // --- Outreach agent --------------------------------------------------------

  async listOutreachCampaigns(): Promise<OutreachCampaign[]> {
    return this.db.select().from(outreachCampaign).orderBy(desc(outreachCampaign.createdAt));
  }
  async getOutreachCampaign(id: string): Promise<OutreachCampaign | null> {
    return (await this.db.select().from(outreachCampaign).where(eq(outreachCampaign.id, id)).limit(1))[0] ?? null;
  }
  async insertOutreachCampaign(values: Omit<NewOutreachCampaign, "id" | "createdAt" | "updatedAt">): Promise<OutreachCampaign> {
    return (await this.db.insert(outreachCampaign).values(values).returning())[0]!;
  }
  async updateOutreachCampaign(id: string, patch: Partial<Omit<NewOutreachCampaign, "id" | "createdAt">>): Promise<OutreachCampaign | null> {
    return (await this.db.update(outreachCampaign).set({ ...patch, updatedAt: new Date() }).where(eq(outreachCampaign.id, id)).returning())[0] ?? null;
  }
  async deleteOutreachCampaign(id: string): Promise<void> {
    await this.db.delete(outreachCampaign).where(eq(outreachCampaign.id, id));
  }

  async listOutreachLeads(campaignId: string, opts: { status?: OutreachLeadStatus; limit?: number } = {}): Promise<OutreachLead[]> {
    const conds = [eq(outreachLead.campaignId, campaignId)];
    if (opts.status) conds.push(eq(outreachLead.status, opts.status));
    const q = this.db.select().from(outreachLead).where(and(...conds)).orderBy(asc(outreachLead.createdAt));
    return opts.limit ? q.limit(opts.limit) : q;
  }
  async getOutreachLead(id: string): Promise<OutreachLead | null> {
    return (await this.db.select().from(outreachLead).where(eq(outreachLead.id, id)).limit(1))[0] ?? null;
  }
  async getOutreachLeadByToken(token: string): Promise<OutreachLead | null> {
    return (await this.db.select().from(outreachLead).where(eq(outreachLead.unsubscribeToken, token)).limit(1))[0] ?? null;
  }
  async insertOutreachLeads(rows: Omit<NewOutreachLead, "id" | "createdAt" | "updatedAt">[]): Promise<number> {
    let n = 0;
    for (let i = 0; i < rows.length; i += 5) {
      const chunk = rows.slice(i, i + 5);
      n += (await this.db.insert(outreachLead).values(chunk).returning({ id: outreachLead.id })).length;
    }
    return n;
  }
  async updateOutreachLead(id: string, patch: Partial<Omit<NewOutreachLead, "id" | "createdAt">>): Promise<OutreachLead | null> {
    return (await this.db.update(outreachLead).set({ ...patch, updatedAt: new Date() }).where(eq(outreachLead.id, id)).returning())[0] ?? null;
  }
  async touchOutreachLead(id: string, at: Date): Promise<void> {
    await this.db.update(outreachLead).set({ lastEventAt: at, updatedAt: new Date() }).where(eq(outreachLead.id, id));
  }
  /** Mark a lead as being sent to; returns false if someone else got there first. */
  async claimOutreachLead(id: string): Promise<boolean> {
    const rows = await this.db.update(outreachLead).set({ status: "sending", updatedAt: new Date() })
      .where(and(eq(outreachLead.id, id), inArray(outreachLead.status, ["queued", "in_sequence"]))).returning({ id: outreachLead.id });
    return rows.length > 0;
  }
  async listDueOutreachLeads(campaignId: string, now: Date, limit: number): Promise<OutreachLead[]> {
    return this.db.select().from(outreachLead)
      .where(and(eq(outreachLead.campaignId, campaignId), inArray(outreachLead.status, ["queued", "in_sequence"]), lte(outreachLead.nextSendAt, now)))
      .orderBy(asc(outreachLead.nextSendAt)).limit(limit);
  }
  async countOutreachLeads(campaignId: string, statuses?: OutreachLeadStatus[]): Promise<number> {
    const conds = [eq(outreachLead.campaignId, campaignId)];
    if (statuses?.length) conds.push(inArray(outreachLead.status, statuses));
    const rows = await this.db.select({ n: sql<number>`count(*)` }).from(outreachLead).where(and(...conds));
    return Number(rows[0]?.n ?? 0);
  }
  async outreachLeadCountsByStatus(campaignId?: string): Promise<Map<string, number>> {
    const q = this.db.select({ status: outreachLead.status, n: sql<number>`count(*)` }).from(outreachLead);
    const rows = campaignId ? await q.where(eq(outreachLead.campaignId, campaignId)).groupBy(outreachLead.status) : await q.groupBy(outreachLead.status);
    return new Map(rows.map((r) => [r.status, Number(r.n)]));
  }
  /** Prospect ids that already sit in any campaign created within the last N days. */
  async recentlyContactedProspectIds(days: number): Promise<Set<string>> {
    if (days <= 0) return new Set();
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.db.select({ pid: outreachLead.prospectId }).from(outreachLead).where(gte(outreachLead.createdAt, since));
    return new Set(rows.map((r) => r.pid).filter((x): x is string => Boolean(x)));
  }

  async insertOutreachMessage(values: Omit<OutreachMessage, "id" | "createdAt" | "openedAt" | "clickedAt" | "error"> & Partial<Pick<OutreachMessage, "openedAt" | "clickedAt" | "error">>): Promise<OutreachMessage> {
    return (await this.db.insert(outreachMessage).values(values).returning())[0]!;
  }
  async listOutreachMessages(leadId: string): Promise<OutreachMessage[]> {
    return this.db.select().from(outreachMessage).where(eq(outreachMessage.leadId, leadId)).orderBy(asc(outreachMessage.sentAt));
  }
  async listCampaignMessages(campaignId: string, limit = 200): Promise<OutreachMessage[]> {
    return this.db.select().from(outreachMessage).where(eq(outreachMessage.campaignId, campaignId)).orderBy(desc(outreachMessage.sentAt)).limit(limit);
  }
  async findOutreachMessageByResendId(resendId: string): Promise<OutreachMessage | null> {
    return (await this.db.select().from(outreachMessage).where(eq(outreachMessage.resendId, resendId)).limit(1))[0] ?? null;
  }
  async updateOutreachMessage(id: string, patch: Partial<Omit<OutreachMessage, "id" | "createdAt">>): Promise<void> {
    await this.db.update(outreachMessage).set(patch).where(eq(outreachMessage.id, id));
  }
  async countOutreachSentSince(campaignId: string, since: Date): Promise<number> {
    const rows = await this.db.select({ n: sql<number>`count(*)` }).from(outreachMessage).where(and(eq(outreachMessage.campaignId, campaignId), gte(outreachMessage.sentAt, since)));
    return Number(rows[0]?.n ?? 0);
  }
  async outreachMessageCountsByStatus(campaignId?: string): Promise<Map<string, number>> {
    const q = this.db.select({ status: outreachMessage.status, n: sql<number>`count(*)` }).from(outreachMessage);
    const rows = campaignId ? await q.where(eq(outreachMessage.campaignId, campaignId)).groupBy(outreachMessage.status) : await q.groupBy(outreachMessage.status);
    return new Map(rows.map((r) => [r.status, Number(r.n)]));
  }

  // --- AI usage (outreach agent spend) --------------------------------------

  async insertAiUsage(values: Omit<NewAiUsage, "id" | "createdAt">): Promise<void> {
    await this.db.insert(aiUsage).values(values);
  }
  /** Every call since `since`, oldest first (bounded by the caller's window; a month is a few hundred rows at most). */
  async listAiUsageSince(since: Date): Promise<AiUsage[]> {
    return this.db.select().from(aiUsage).where(gte(aiUsage.createdAt, since)).orderBy(asc(aiUsage.createdAt));
  }
  async countOutreachSentBetween(from: Date, to: Date): Promise<number> {
    const rows = await this.db.select({ id: outreachMessage.id }).from(outreachMessage).where(and(gte(outreachMessage.sentAt, from), lte(outreachMessage.sentAt, to)));
    return rows.length;
  }

  async isSuppressed(email: string): Promise<boolean> {
    const rows = await this.db.select({ id: outreachSuppression.id }).from(outreachSuppression).where(eq(outreachSuppression.email, email.toLowerCase())).limit(1);
    return rows.length > 0;
  }
  async addSuppression(email: string, reason: SuppressionReason, note: string | null): Promise<void> {
    const e = email.toLowerCase();
    if (await this.isSuppressed(e)) return;
    await this.db.insert(outreachSuppression).values({ email: e, reason, note });
  }
  async removeSuppression(email: string): Promise<void> {
    await this.db.delete(outreachSuppression).where(eq(outreachSuppression.email, email.toLowerCase()));
  }
  async listSuppressions(limit = 500): Promise<OutreachSuppression[]> {
    return this.db.select().from(outreachSuppression).orderBy(desc(outreachSuppression.createdAt)).limit(limit);
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

  // --- Platform owner's task planner --------------------------------------

  async listTasks(): Promise<PlatformTask[]> {
    return this.db
      .select()
      .from(platformTask)
      .orderBy(asc(platformTask.sortOrder), asc(platformTask.dueDate), desc(platformTask.createdAt));
  }

  async createTask(values: Omit<NewPlatformTask, "id" | "createdAt" | "updatedAt">): Promise<PlatformTask> {
    const rows = await this.db.insert(platformTask).values(values).returning();
    return rows[0]!;
  }

  async updateTask(id: string, patch: Partial<Omit<NewPlatformTask, "id" | "createdAt">>): Promise<PlatformTask | null> {
    const rows = await this.db
      .update(platformTask)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(platformTask.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async setTaskStatus(id: string, status: TaskStatus): Promise<PlatformTask | null> {
    return this.updateTask(id, { status });
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.delete(platformTask).where(eq(platformTask.id, id));
  }
}
