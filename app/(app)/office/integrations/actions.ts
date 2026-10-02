"use server";

import { sanitiseTypeChoices } from "@/lib/services/course-type-resolve";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { integration as integrationTable, INTEGRATION_KINDS, type IntegrationKind } from "@/lib/db/schema";
import { providerById } from "@/lib/integrations/catalogue";
import { fetchIntegrationDrafts, applyChanges, diffFeed, type FeedDiff } from "@/lib/services/integrations";
import { assertSafeFeedUrl } from "@/lib/integrations/url-guard";
import { isSafeFeedUrl } from "@/lib/integrations/url-guard";
import { writeAudit } from "@/lib/services/audit";

export type IntegrationResult = { ok: boolean; error?: string; message?: string };

const validFeedUrl = isSafeFeedUrl;
/** Connect (or update) a booking system via its calendar feed URL, or API key. One row per provider. */
export async function connectIntegrationAction(input: { provider: string; kind?: string; feedUrl?: string; token?: string }): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const provider = providerById(input.provider);
  if (!provider) return { ok: false, error: "Unknown provider" };
  const kind: IntegrationKind = (INTEGRATION_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as IntegrationKind) : "ics";
  const feedUrl = (input.feedUrl ?? "").trim();
  const token = (input.token ?? "").trim();
  if (kind === "ics" && !validFeedUrl(feedUrl)) {
    // Give a specific reason where we can (blocked host, wrong scheme, junk text).
    let why = "";
    try { assertSafeFeedUrl(feedUrl); } catch (e) { why = ` — ${(e as Error).message}`; }
    return { ok: false, error: `That doesn't look like a valid calendar feed URL. Paste the full https:// iCal / calendar link (it usually ends in .ics)${why}.` };
  }
  if (kind === "api" && !token) return { ok: false, error: "Enter your API key" };

  // Verify the feed/key actually works BEFORE saving — this catches a wrong URL
  // or key (unreachable, not a calendar, empty response, bad credentials).
  let verifiedCount: number | null = null;
  try {
    const drafts = await fetchIntegrationDrafts({ kind, provider: input.provider, feedUrl: kind === "ics" ? feedUrl : null, token: kind === "api" ? token : null });
    verifiedCount = drafts.length;
  } catch (err) {
    const detail = (err as Error).message || "we couldn't read it";
    return {
      ok: false,
      error: kind === "api"
        ? `Couldn't connect with that API key — please double-check it. (${detail})`
        : `Couldn't read a calendar feed at that URL — check you copied the iCal / calendar feed link, not the booking page address. (${detail})`,
    };
  }

  const patch = { kind, feedUrl: kind === "ics" ? feedUrl : null, token: kind === "api" ? token : null, status: "connected" as const, lastResult: verifiedCount != null ? `Verified — ${verifiedCount} upcoming event${verifiedCount === 1 ? "" : "s"} in the feed` : null };
  const existing = (await repos.tenant.integration.list(ctx, eq(integrationTable.provider, input.provider)))[0];
  if (existing) {
    await repos.tenant.integration.update(ctx, existing.id, patch);
  } else {
    await repos.tenant.integration.insert(ctx, { provider: input.provider, ...patch });
  }
  await writeAudit(repos, ctx, { action: "integration_connect", entity: "integration", after: { provider: input.provider, kind } });
  revalidatePath("/office/courses");
  revalidatePath("/office/integrations");
  const suffix = verifiedCount === 0
    ? " — but no upcoming events were found in the feed. If you expected some, double-check the URL."
    : verifiedCount != null ? ` — ${verifiedCount} upcoming event${verifiedCount === 1 ? "" : "s"} found. Press “Check for updates” to review them.` : "";
  return { ok: true, message: `${provider.name} connected${suffix}` };
}

export async function removeIntegrationAction(id: string): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const removed = await repos.tenant.integration.delete(ctx, id);
  if (removed === 0) return { ok: false, error: "Not found" };
  await writeAudit(repos, ctx, { action: "integration_remove", entity: "integration", entityId: id });
  revalidatePath("/office/courses");
  revalidatePath("/office/integrations");
  return { ok: true, message: "Disconnected" };
}

export type PreviewResult = { ok: true; diff: FeedDiff; types: { id: string; name: string }[] } | { ok: false; error: string };

/**
 * Check the feed for changes WITHOUT importing anything: returns new events to
 * add and previously-imported courses no longer in the feed (to review). Nothing
 * is created or deleted here.
 */
export async function previewIntegrationChangesAction(id: string): Promise<PreviewResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const row = (await repos.tenant.integration.list(ctx, eq(integrationTable.id, id)))[0];
  if (!row) return { ok: false, error: "Not found" };
  try {
    const drafts = await fetchIntegrationDrafts(row);
    const diff = await diffFeed(repos, ctx, drafts, `integration:${row.provider}`);
    await repos.tenant.integration.update(ctx, id, { status: "connected", lastResult: `${diff.toAdd.length} new · ${diff.toRemove.length} removed · ${diff.unchanged} unchanged` });
    const types = (await repos.tenant.courseType.list(ctx))
      .filter((c) => c.active && c.listed)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, diff, types };
  } catch (err) {
    const msg = (err as Error).message || "Check failed";
    await repos.tenant.integration.update(ctx, id, { status: "error", lastResult: msg });
    return { ok: false, error: msg };
  }
}

/** Apply the admin's chosen additions/removals. Never changes anything not selected. */
export async function applyIntegrationChangesAction(id: string, addKeys: string[], removeCourseIds: string[], typeChoices?: Record<string, string>): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const row = (await repos.tenant.integration.list(ctx, eq(integrationTable.id, id)))[0];
  if (!row) return { ok: false, error: "Not found" };
  if ((addKeys?.length ?? 0) === 0 && (removeCourseIds?.length ?? 0) === 0) return { ok: false, error: "Nothing selected" };
  try {
    const drafts = await fetchIntegrationDrafts(row);
    const out = await applyChanges(repos, ctx, drafts, `integration:${row.provider}`, addKeys ?? [], removeCourseIds ?? [], sanitiseTypeChoices(typeChoices));
    const summary = `${out.added} added · ${out.removed} removed`;
    await repos.tenant.integration.update(ctx, id, { status: "connected", lastSyncedAt: new Date(), lastResult: summary });
    revalidatePath("/office/courses");
    revalidatePath("/office/integrations");
    revalidatePath("/office");
    return { ok: true, message: summary };
  } catch (err) {
    const msg = (err as Error).message || "Update failed";
    await repos.tenant.integration.update(ctx, id, { status: "error", lastResult: msg });
    return { ok: false, error: msg };
  }
}
