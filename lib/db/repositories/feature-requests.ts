import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  featureRequest,
  featureRequestVote,
  organisation,
  type FeatureRequest,
  type FeatureRequestStatus,
  type NewFeatureRequest,
} from "@/lib/db/schema";
import type { AnyTenantContext } from "@/lib/tenant/context";

/**
 * What every signed-in centre may see of a request on the shared board: the
 * public title, kind, stage and vote count. Nothing about who sent it, and
 * none of the brief. The board query selects these columns and no others.
 */
export interface BoardItem {
  id: string;
  publicTitle: string;
  kind: FeatureRequest["kind"];
  status: FeatureRequestStatus;
  votes: number;
  createdAt: Date;
  /** The viewing centre sent this one (so it can't vote for its own). */
  mine: boolean;
  /** The viewing centre has said "we need this too". */
  voted: boolean;
}

export type CentreFeatureRequestInput = Omit<NewFeatureRequest, "id" | "organisationId" | "status" | "hidden" | "responseToCentre" | "statusChangedAt" | "createdAt" | "updatedAt" | "publicTitle" | "screenshotKey">;

/**
 * Feature requests: control-plane rows (feedback to ActivityRoster, read across
 * centres in the Dev Center) that a centre reaches only through the centre
 * methods below, each of which takes the organisation from the TenantContext
 * and never from input. The `platform*` methods are for the Dev Center only and
 * must sit behind requirePlatformAdmin.
 */
export class FeatureRequestRepository {
  constructor(private readonly db: Database) {}

  // --- Centre side (org always from ctx) -----------------------------------

  async create(ctx: AnyTenantContext, values: CentreFeatureRequestInput): Promise<FeatureRequest> {
    const rows = await this.db.insert(featureRequest).values({
      ...values,
      organisationId: ctx.organisationId,
      publicTitle: values.title,
      status: "submitted",
      hidden: false,
    }).returning();
    return rows[0]!;
  }

  async setScreenshotKey(ctx: AnyTenantContext, id: string, key: string): Promise<void> {
    await this.db.update(featureRequest).set({ screenshotKey: key })
      .where(and(eq(featureRequest.id, id), eq(featureRequest.organisationId, ctx.organisationId)));
  }

  /** The centre's own requests, in full (it wrote them). */
  async listForCentre(ctx: AnyTenantContext, limit = 200): Promise<(FeatureRequest & { votes: number })[]> {
    const rows = await this.db.select().from(featureRequest)
      .where(eq(featureRequest.organisationId, ctx.organisationId))
      .orderBy(desc(featureRequest.createdAt)).limit(limit);
    const counts = await this.voteCounts(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, votes: counts.get(r.id) ?? 0 }));
  }

  async findForCentre(ctx: AnyTenantContext, id: string): Promise<FeatureRequest | null> {
    const rows = await this.db.select().from(featureRequest)
      .where(and(eq(featureRequest.id, id), eq(featureRequest.organisationId, ctx.organisationId))).limit(1);
    return rows[0] ?? null;
  }

  /** How many requests this centre sent since `since` (a daily cap). */
  async countSince(ctx: AnyTenantContext, since: Date): Promise<number> {
    const rows = await this.db.select({ n: sql<number>`count(*)` }).from(featureRequest)
      .where(and(eq(featureRequest.organisationId, ctx.organisationId), sql`${featureRequest.createdAt} >= ${since.getTime()}`));
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * The shared board: every reviewed, visible request from every centre, as
   * BoardItem only. Requests still "submitted" or hidden by the platform never
   * appear, and no column naming or describing the sender is selected.
   */
  async board(ctx: AnyTenantContext, limit = 300): Promise<BoardItem[]> {
    const rows = await this.db.select({
      id: featureRequest.id,
      publicTitle: featureRequest.publicTitle,
      kind: featureRequest.kind,
      status: featureRequest.status,
      createdAt: featureRequest.createdAt,
      mine: sql<number>`${featureRequest.organisationId} = ${ctx.organisationId}`,
    }).from(featureRequest)
      .where(and(ne(featureRequest.status, "submitted"), eq(featureRequest.hidden, false)))
      .orderBy(desc(featureRequest.createdAt)).limit(limit);
    const ids = rows.map((r) => r.id);
    const counts = await this.voteCounts(ids);
    const mineVoted = ids.length
      ? new Set((await this.db.select({ id: featureRequestVote.requestId }).from(featureRequestVote)
        .where(and(eq(featureRequestVote.organisationId, ctx.organisationId), inArray(featureRequestVote.requestId, ids)))).map((v) => v.id))
      : new Set<string>();
    return rows.map((r) => ({
      id: r.id, publicTitle: r.publicTitle, kind: r.kind, status: r.status, createdAt: r.createdAt,
      votes: counts.get(r.id) ?? 0, mine: Boolean(r.mine), voted: mineVoted.has(r.id),
    }));
  }

  /**
   * Add or take back this centre's "we need this too". Only on requests that are
   * on the board, and never on the centre's own. Returns the new state, or null
   * when the request can't be voted on.
   */
  async toggleVote(ctx: AnyTenantContext, requestId: string): Promise<{ voted: boolean } | null> {
    const target = (await this.db.select({ org: featureRequest.organisationId, status: featureRequest.status, hidden: featureRequest.hidden })
      .from(featureRequest).where(eq(featureRequest.id, requestId)).limit(1))[0];
    if (!target || target.status === "submitted" || target.hidden || target.org === ctx.organisationId) return null;
    const removed = await this.db.delete(featureRequestVote)
      .where(and(eq(featureRequestVote.requestId, requestId), eq(featureRequestVote.organisationId, ctx.organisationId)))
      .returning({ id: featureRequestVote.id });
    if (removed.length) return { voted: false };
    await this.db.insert(featureRequestVote).values({ requestId, organisationId: ctx.organisationId })
      .onConflictDoNothing({ target: [featureRequestVote.requestId, featureRequestVote.organisationId] });
    return { voted: true };
  }

  private async voteCounts(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await this.db.select({ id: featureRequestVote.requestId, n: sql<number>`count(*)` })
      .from(featureRequestVote).where(inArray(featureRequestVote.requestId, ids)).groupBy(featureRequestVote.requestId);
    return new Map(rows.map((r) => [r.id, Number(r.n)]));
  }

  // --- Dev Center (platform admin only) ------------------------------------

  async platformList(limit = 500): Promise<(FeatureRequest & { centreName: string; centreSlug: string; votes: number })[]> {
    const rows = await this.db.select({ f: featureRequest, centreName: organisation.name, centreSlug: organisation.slug })
      .from(featureRequest).innerJoin(organisation, eq(organisation.id, featureRequest.organisationId))
      .orderBy(asc(featureRequest.createdAt)).limit(limit);
    const counts = await this.voteCounts(rows.map((r) => r.f.id));
    return rows.map((r) => ({ ...r.f, centreName: r.centreName, centreSlug: r.centreSlug, votes: counts.get(r.f.id) ?? 0 }));
  }

  async platformFind(id: string): Promise<(FeatureRequest & { centreName: string; centreSlug: string }) | null> {
    const r = (await this.db.select({ f: featureRequest, centreName: organisation.name, centreSlug: organisation.slug })
      .from(featureRequest).innerJoin(organisation, eq(organisation.id, featureRequest.organisationId))
      .where(eq(featureRequest.id, id)).limit(1))[0];
    return r ? { ...r.f, centreName: r.centreName, centreSlug: r.centreSlug } : null;
  }

  async platformUpdate(id: string, patch: { status?: FeatureRequestStatus; publicTitle?: string; hidden?: boolean; responseToCentre?: string | null }): Promise<FeatureRequest | null> {
    const set: Partial<NewFeatureRequest> = { ...patch };
    if (patch.status) set.statusChangedAt = new Date();
    const rows = await this.db.update(featureRequest).set(set).where(eq(featureRequest.id, id)).returning();
    return rows[0] ?? null;
  }
}
