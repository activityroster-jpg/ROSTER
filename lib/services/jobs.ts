import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/db/repositories";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { jobPost, jobSync, type JobPost, type JobSyncAction, type Organisation } from "@/lib/db/schema";
import type { AnyTenantContext, SystemTenantContext } from "@/lib/tenant/context";
import { writeAudit } from "@/lib/services/audit";
import { closeJob as closeRemote, publishJob as publishRemote, updateJob as updateRemote, type PartnerConfig, type PartnerResult } from "@/lib/boatyjobs/client";
import {
  backoffMs, buildPayload, canClose, canDelete, canEdit, canPublish, canRenew, canTakeSlot, editNeedsSync, listingEndsAt,
  MAX_LIVE_JOBS, parseQualifications, regionFor, shouldGiveUp, type BoatyRegion, type PayloadCentre,
} from "@/lib/domain/jobs";
import type { JobInput, RecruitProfileInput } from "@/lib/validation/jobs";

/**
 * Recruiting on Boaty Jobs. ActivityRoster holds the master copy of every job
 * post; Boaty Jobs (boatyjobs.com, also ActiveRoster Ltd) only displays it and
 * emails applications to the centre. Calls to Boaty Jobs go through the
 * job_sync outbox, which the delivery job sends every couple of minutes with
 * retries and backoff (runJobSync). The rules live in lib/domain/jobs.
 */

export type JobActionResult = { ok: true; job?: JobPost } | { ok: false; error: string };

// --- The centre's details on Boaty Jobs ---------------------------------------------

export interface CentreDetails {
  town: string;
  postcode: string;
  /** Stored choice (england…), or null to follow the jurisdiction. */
  regionValue: string | null;
  region: BoatyRegion | null;
  website: string;
  logoUrl: string;
  /** Where applications go by default: the saved address, else the owner's email. */
  email: string;
}

export async function centreDetails(repos: Repositories, ctx: AnyTenantContext, org: Pick<Organisation, "id" | "jurisdiction">): Promise<CentreDetails> {
  const [s] = await repos.tenant.orgSettings.list(ctx);
  const owner = s?.recruitEmail ? null : await repos.control.ownerEmailForOrg(org.id);
  return {
    town: s?.recruitTown ?? "",
    postcode: s?.recruitPostcode ?? "",
    regionValue: s?.recruitRegion ?? null,
    region: regionFor(s?.recruitRegion, org.jurisdiction),
    website: s?.recruitWebsite ?? "",
    logoUrl: s?.recruitLogoUrl ?? "",
    email: s?.recruitEmail ?? owner ?? "",
  };
}

export async function saveCentreDetails(repos: Repositories, ctx: AnyTenantContext, input: RecruitProfileInput, now = new Date()): Promise<void> {
  const [s] = await repos.tenant.orgSettings.list(ctx);
  const patch = {
    recruitTown: input.town || null,
    recruitPostcode: input.postcode || null,
    recruitRegion: input.region,
    recruitWebsite: input.website || null,
    recruitLogoUrl: input.logoUrl || null,
    recruitEmail: input.email || null,
  };
  if (s) await repos.tenant.orgSettings.update(ctx, s.id, patch);
  else await repos.tenant.orgSettings.insert(ctx, patch);
  // Listings on Boaty Jobs carry these details: send them the change too.
  for (const job of await repos.tenant.jobPost.list(ctx)) if (editNeedsSync(job)) await enqueue(repos, ctx, job.id, "update", now);
  await writeAudit(repos, ctx, { action: "recruit_details_save", entity: "org_settings", entityId: s?.id ?? null, after: patch });
}

export async function dismissHiringCard(repos: Repositories, ctx: AnyTenantContext, now = new Date()): Promise<void> {
  const [s] = await repos.tenant.orgSettings.list(ctx);
  if (s) await repos.tenant.orgSettings.update(ctx, s.id, { recruitCardDismissedAt: now });
}

// --- Jobs ----------------------------------------------------------------------------------

function fields(input: JobInput) {
  return {
    title: input.title,
    roleType: input.roleType,
    employmentType: input.employmentType,
    positions: input.positions,
    startDate: input.startDate,
    endDate: input.endDate,
    payType: input.payType,
    payAmountGbp: input.payAmountGbp,
    accommodation: input.accommodation,
    locationText: input.locationText,
    requiredQualifications: JSON.stringify(input.requiredQualifications),
    description: input.description,
    closingDate: input.closingDate,
    applicationEmail: input.applicationEmail,
  };
}

export async function listJobs(repos: Repositories, ctx: AnyTenantContext): Promise<JobPost[]> {
  const rows = await repos.tenant.jobPost.list(ctx);
  return rows.sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
}

/** Jobs with a call to Boaty Jobs still on its way (shown as "Sending to Boaty Jobs…"). */
export async function jobsWithPendingSync(repos: Repositories, ctx: AnyTenantContext): Promise<Set<string>> {
  const rows = await repos.tenant.jobSync.list(ctx, eq(jobSync.status, "pending"));
  return new Set(rows.map((r) => r.jobPostId));
}

export async function createJob(repos: Repositories, ctx: AnyTenantContext, input: JobInput, userId: string | null): Promise<JobPost> {
  const job = await repos.tenant.jobPost.insert(ctx, { ...fields(input), status: "draft", createdByUserId: userId });
  await writeAudit(repos, ctx, { action: "job_create", entity: "job_post", entityId: job.id, after: { title: job.title } });
  return job;
}

export async function editJob(repos: Repositories, ctx: AnyTenantContext, id: string, input: JobInput, now = new Date()): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (!canEdit(job)) return { ok: false, error: job.status === "removed" ? "Boaty Jobs removed this listing, so it can't be changed." : "Wait for it to finish publishing, then edit." };
  if (editNeedsSync(job) && input.closingDate < today(now)) return { ok: false, error: "The closing date has passed. Set a later one, or close the job." };
  const updated = await repos.tenant.jobPost.update(ctx, id, fields(input));
  if (editNeedsSync(job)) await enqueue(repos, ctx, id, "update", now);
  await writeAudit(repos, ctx, { action: "job_edit", entity: "job_post", entityId: id, after: { title: input.title, synced: editNeedsSync(job) } });
  return { ok: true, job: updated ?? undefined };
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** What must be true before a job can go to Boaty Jobs (first publish, renew). */
async function readyToGoLive(repos: Repositories, ctx: AnyTenantContext, job: JobPost, org: Pick<Organisation, "id" | "jurisdiction">, now: Date): Promise<string | null> {
  if (job.closingDate < today(now)) return "The closing date has passed. Set a later one first.";
  const centre = await centreDetails(repos, ctx, org);
  if (!centre.town || !centre.region) return "Add your centre's town and region (Centre details on Boaty Jobs) first.";
  const all = await repos.tenant.jobPost.list(ctx);
  if (!canTakeSlot(all, job.id)) return `You can have up to ${MAX_LIVE_JOBS} live jobs at once. Close one first.`;
  return null;
}

export async function publishJob(repos: Repositories, ctx: AnyTenantContext, id: string, org: Pick<Organisation, "id" | "jurisdiction">, now = new Date()): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (!canPublish(job)) return { ok: false, error: "This job is already on Boaty Jobs." };
  const problem = await readyToGoLive(repos, ctx, job, org, now);
  if (problem) return { ok: false, error: problem };
  const updated = await repos.tenant.jobPost.update(ctx, id, { status: "publishing", syncError: null });
  await enqueue(repos, ctx, id, "publish", now);
  await writeAudit(repos, ctx, { action: "job_publish", entity: "job_post", entityId: id, after: { title: job.title } });
  return { ok: true, job: updated ?? undefined };
}

/** Renew: republish a live, expired or closed listing for another 60 days. */
export async function renewJob(repos: Repositories, ctx: AnyTenantContext, id: string, org: Pick<Organisation, "id" | "jurisdiction">, now = new Date()): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (!canRenew(job)) return { ok: false, error: job.status === "removed" ? "Boaty Jobs removed this listing, so it can't be renewed." : "Only a live, closed or expired job can be renewed." };
  const problem = await readyToGoLive(repos, ctx, job, org, now);
  if (problem) return { ok: false, error: problem };
  const updated = await repos.tenant.jobPost.update(ctx, id, { status: "publishing", syncError: null });
  await enqueue(repos, ctx, id, "publish", now, { fresh: true });
  await writeAudit(repos, ctx, { action: "job_renew", entity: "job_post", entityId: id, after: { title: job.title } });
  return { ok: true, job: updated ?? undefined };
}

export async function closeJob(repos: Repositories, ctx: AnyTenantContext, id: string, now = new Date()): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (!canClose(job)) return { ok: false, error: "Only a live job can be closed." };
  const updated = await repos.tenant.jobPost.update(ctx, id, { status: "closed", syncError: null });
  await enqueue(repos, ctx, id, "close", now);
  await writeAudit(repos, ctx, { action: "job_close", entity: "job_post", entityId: id, after: { title: job.title } });
  return { ok: true, job: updated ?? undefined };
}

/** Try a failed sync again: the call that gave up is queued once more, with the same idempotency key. */
export async function retryJob(repos: Repositories, ctx: AnyTenantContext, id: string, now = new Date()): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (job.status !== "sync_failed") return { ok: false, error: "Nothing to retry." };
  const [last] = (await repos.tenant.jobSync.list(ctx, eq(jobSync.jobPostId, id))).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  const action: JobSyncAction = last?.action ?? (job.listingId ? "update" : "publish");
  const status = action === "publish" ? "publishing" : action === "close" ? "closed" : "live";
  const updated = await repos.tenant.jobPost.update(ctx, id, { status, syncError: null });
  await repos.tenant.jobSync.insert(ctx, { jobPostId: id, action, idempotencyKey: last?.idempotencyKey ?? crypto.randomUUID(), nextAttemptAt: now, createdAt: now });
  await writeAudit(repos, ctx, { action: "job_retry", entity: "job_post", entityId: id, after: { action } });
  return { ok: true, job: updated ?? undefined };
}

export async function deleteDraft(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<JobActionResult> {
  const job = await repos.tenant.jobPost.findById(ctx, id);
  if (!job) return { ok: false, error: "That job wasn't found." };
  if (!canDelete(job)) return { ok: false, error: "Only a draft that was never published can be deleted. Close it instead." };
  await repos.tenant.jobPost.delete(ctx, id);
  await writeAudit(repos, ctx, { action: "job_delete", entity: "job_post", entityId: id, before: { title: job.title } });
  return { ok: true };
}

/**
 * Queue a call to Boaty Jobs. The payload is built when the call is sent, from
 * the job as it is then, so an update queued behind a publish is redundant and
 * is skipped; a close supersedes anything still waiting for that job.
 */
async function enqueue(repos: Repositories, ctx: AnyTenantContext, jobId: string, action: JobSyncAction, now: Date, opts: { fresh?: boolean } = {}): Promise<void> {
  const pending = await repos.tenant.jobSync.list(ctx, and(eq(jobSync.jobPostId, jobId), eq(jobSync.status, "pending")));
  if (action === "update" && pending.some((p) => p.action === "update" || p.action === "publish")) return;
  if (action === "close" || action === "publish") {
    // A new publish replaces everything waiting; a close replaces waiting publishes and updates.
    const superseded = pending.filter((p) => action === "publish" || p.action !== "close").map((p) => p.id);
    if (superseded.length) await repos.tenant.jobSync.updateWhere(ctx, inArray(jobSync.id, superseded), { status: "done", lastError: "superseded" });
  }
  // One idempotency key per listing run: a retried publish reuses it; Renew starts a new run.
  let key: string = crypto.randomUUID();
  if (action === "publish" && !opts.fresh) {
    const [prev] = (await repos.tenant.jobSync.list(ctx, and(eq(jobSync.jobPostId, jobId), eq(jobSync.action, "publish")))).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (prev && prev.status !== "done") key = prev.idempotencyKey;
  }
  await repos.tenant.jobSync.insert(ctx, { jobPostId: jobId, action, idempotencyKey: key, nextAttemptAt: now, createdAt: now });
}

// --- The sync run (delivery job, every couple of minutes) ------------------------------------

function systemCtx(org: Pick<Organisation, "id" | "slug">): SystemTenantContext {
  return { organisationId: org.id, slug: org.slug, system: true, reason: "boaty_jobs_sync" };
}

export interface JobSyncSummary { due: number; sent: number; retrying: number; failed: number; lapsed: number }

/**
 * Send the Boaty Jobs calls that are due. Each call is leased first (attempt
 * counted, next try scheduled) so two overlapping runs can't send it twice;
 * a publish carries its Idempotency-Key as well. Failures back off 1, 2, 4 …
 * up to 60 minutes; one still failing 24 hours after it was queued, or refused
 * outright, marks the job sync_failed with a Retry button.
 */
export async function runJobSync(db: Database, cfg: PartnerConfig, now = new Date(), limit = 25): Promise<JobSyncSummary> {
  const platform = new PlatformRepository(db);
  const repos = createRepositories(db);
  const due = await platform.dueJobSyncs(now, limit);
  const out: JobSyncSummary = { due: due.length, sent: 0, retrying: 0, failed: 0, lapsed: 0 };
  const orgs = new Map<string, Organisation | null>();
  for (const row of due) {
    if (!orgs.has(row.organisationId)) orgs.set(row.organisationId, await repos.control.organisationById(row.organisationId));
    const org = orgs.get(row.organisationId);
    if (!org) continue;
    const ctx = systemCtx(org);
    const sync = await repos.tenant.jobSync.findById(ctx, row.id);
    if (!sync || sync.status !== "pending") continue;
    const job = await repos.tenant.jobPost.findById(ctx, sync.jobPostId);
    if (!job) { await repos.tenant.jobSync.update(ctx, sync.id, { status: "done", lastError: "job deleted" }); continue; }
    const attempts = sync.attempts + 1;
    await repos.tenant.jobSync.update(ctx, sync.id, { attempts, nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)) });

    const centre = await centreDetails(repos, ctx, org);
    const payload = buildPayload({ ...job, requiredQualifications: parseQualifications(job.requiredQualifications), accommodation: Boolean(job.accommodation) }, payloadCentre(org, centre));
    let res: PartnerResult;
    if (sync.action === "publish") res = await publishRemote(cfg, payload, sync.idempotencyKey);
    else if (sync.action === "update") res = await updateRemote(cfg, payload);
    else res = await closeRemote(cfg, job.id);

    if (res.ok) {
      out.sent++;
      await repos.tenant.jobSync.update(ctx, sync.id, { status: "done", lastError: null });
      if (sync.action === "publish") {
        await repos.tenant.jobPost.update(ctx, job.id, {
          status: "live",
          listingId: res.listingId ?? job.listingId,
          publicUrl: res.publicUrl ?? job.publicUrl,
          expiresAt: res.expiresAt ?? new Date(listingEndsAt(now.getTime(), job.closingDate)),
          firstPublishedAt: job.firstPublishedAt ?? now,
          removedReason: null,
          syncError: null,
        });
      } else if (sync.action === "update") {
        await repos.tenant.jobPost.update(ctx, job.id, { ...(job.status === "sync_failed" ? { status: "live" as const } : {}), ...(res.expiresAt ? { expiresAt: res.expiresAt } : {}), ...(res.publicUrl ? { publicUrl: res.publicUrl } : {}), syncError: null });
      } else {
        await repos.tenant.jobPost.update(ctx, job.id, { status: "closed", syncError: null });
      }
      continue;
    }
    if (!res.retry || shouldGiveUp(Number(sync.createdAt), now.getTime())) {
      out.failed++;
      await repos.tenant.jobSync.update(ctx, sync.id, { status: "failed", lastError: res.error });
      await repos.tenant.jobPost.update(ctx, job.id, { status: "sync_failed", syncError: res.error });
    } else {
      out.retrying++;
      await repos.tenant.jobSync.update(ctx, sync.id, { lastError: res.error });
    }
  }

  // A live listing past its end date is expired, in case Boaty Jobs' message never came.
  for (const lapsed of await platform.lapsedLiveJobs(new Date(now.getTime() - 60 * 60 * 1000))) {
    const org = orgs.get(lapsed.organisationId) ?? (await repos.control.organisationById(lapsed.organisationId));
    if (!org) continue;
    await repos.tenant.jobPost.updateWhere(systemCtx(org), and(eq(jobPost.id, lapsed.id), eq(jobPost.status, "live"))!, { status: "expired" });
    out.lapsed++;
  }
  return out;
}

function payloadCentre(org: Pick<Organisation, "id" | "name">, c: CentreDetails): PayloadCentre {
  return { id: org.id, name: org.name, town: c.town, postcode: c.postcode, region: c.region, website: c.website, logoUrl: c.logoUrl };
}

// --- Webhooks from Boaty Jobs ------------------------------------------------------------------

export const BOATY_EVENTS = ["listing.published", "listing.expired", "listing.removed", "application.received"] as const;
export type BoatyEventType = (typeof BOATY_EVENTS)[number];

export interface BoatyEvent {
  id?: string;
  type: BoatyEventType;
  externalId: string;
  listingId?: string;
  publicUrl?: string;
  expiresAt?: Date;
  reason?: string;
}

/** Read an (already signature-checked) webhook body. Returns null for anything that isn't one of ours. */
export function parseBoatyEvent(body: unknown): BoatyEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const data = (b.data && typeof b.data === "object" ? b.data : b) as Record<string, unknown>;
  const type = typeof b.type === "string" ? b.type : typeof b.event === "string" ? b.event : "";
  if (!(BOATY_EVENTS as readonly string[]).includes(type)) return null;
  const externalId = typeof data.external_id === "string" ? data.external_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(externalId)) return null;
  const str = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const expires = typeof data.expires_at === "string" || typeof data.expires_at === "number" ? new Date(data.expires_at) : undefined;
  const url = str(data.public_url);
  return {
    id: str(b.id, 200),
    type: type as BoatyEventType,
    externalId,
    listingId: str(data.listing_id, 200),
    publicUrl: url && /^https:\/\//.test(url) ? url : undefined,
    expiresAt: expires && !Number.isNaN(expires.getTime()) ? expires : undefined,
    reason: str(data.reason, 500),
  };
}

export type BoatyEventResult = "applied" | "ignored" | "duplicate";

/**
 * Apply a verified Boaty Jobs event to the job it names: published → live,
 * expired → expired, removed → removed (with the reason shown to the centre),
 * application received → the count goes up. `seen` lets the caller drop a
 * redelivered event by its id, so an application is never counted twice.
 */
export async function applyBoatyEvent(db: Database, ev: BoatyEvent, now = new Date(), seen?: (eventId: string) => Promise<boolean>): Promise<BoatyEventResult> {
  const platform = new PlatformRepository(db);
  const repos = createRepositories(db);
  const orgId = await platform.jobPostOrganisation(ev.externalId);
  if (!orgId) return "ignored";
  const org = await repos.control.organisationById(orgId);
  if (!org) return "ignored";
  if (ev.id && seen && (await seen(ev.id))) return "duplicate";
  const ctx = systemCtx(org);
  const job = await repos.tenant.jobPost.findById(ctx, ev.externalId);
  if (!job) return "ignored";
  const t = repos.tenant.jobPost;
  switch (ev.type) {
    case "listing.published":
      // A listing the centre has since closed stays closed.
      if (job.status === "closed" || job.status === "removed") return "ignored";
      await t.update(ctx, job.id, {
        status: "live",
        listingId: ev.listingId ?? job.listingId,
        publicUrl: ev.publicUrl ?? job.publicUrl,
        expiresAt: ev.expiresAt ?? job.expiresAt ?? new Date(listingEndsAt(now.getTime(), job.closingDate)),
        firstPublishedAt: job.firstPublishedAt ?? now,
        syncError: null,
      });
      return "applied";
    case "listing.expired":
      if (job.status === "closed" || job.status === "removed" || job.status === "draft") return "ignored";
      await t.update(ctx, job.id, { status: "expired" });
      return "applied";
    case "listing.removed":
      await t.update(ctx, job.id, { status: "removed", removedReason: ev.reason ?? "Boaty Jobs didn't give a reason." });
      await writeAudit(repos, ctx, { action: "job_removed_by_boaty", entity: "job_post", entityId: job.id, after: { reason: ev.reason ?? null } });
      return "applied";
    case "application.received":
      await t.updateWhere(ctx, eq(jobPost.id, job.id), { applicationsCount: sql`${jobPost.applicationsCount} + 1` as unknown as number });
      return "applied";
  }
}
