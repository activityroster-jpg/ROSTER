"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { integration as integrationTable, INTEGRATION_KINDS, type IntegrationKind } from "@/lib/db/schema";
import { providerById } from "@/lib/integrations/catalogue";
import { fetchIntegrationDrafts, importDrafts } from "@/lib/services/integrations";
import { writeAudit } from "@/lib/services/audit";

export type IntegrationResult = { ok: boolean; error?: string; message?: string };

function validFeedUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "webcal:") && !!u.host;
  } catch {
    return false;
  }
}
/** Connect (or update) a booking system via its calendar feed URL, or API key. One row per provider. */
export async function connectIntegrationAction(input: { provider: string; kind?: string; feedUrl?: string; token?: string }): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const provider = providerById(input.provider);
  if (!provider) return { ok: false, error: "Unknown provider" };
  const kind: IntegrationKind = (INTEGRATION_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as IntegrationKind) : "ics";
  const feedUrl = (input.feedUrl ?? "").trim();
  const token = (input.token ?? "").trim();
  if (kind === "ics" && !validFeedUrl(feedUrl)) return { ok: false, error: "Enter a valid calendar feed URL (https://…)" };
  if (kind === "api" && !token) return { ok: false, error: "Enter your API key" };

  const patch = { kind, feedUrl: kind === "ics" ? feedUrl : null, token: kind === "api" ? token : null, status: "connected" as const, lastResult: null };
  const existing = (await repos.tenant.integration.list(ctx, eq(integrationTable.provider, input.provider)))[0];
  if (existing) {
    await repos.tenant.integration.update(ctx, existing.id, patch);
  } else {
    await repos.tenant.integration.insert(ctx, { provider: input.provider, ...patch });
  }
  await writeAudit(repos, ctx, { action: "integration_connect", entity: "integration", after: { provider: input.provider, kind } });
  revalidatePath("/office/courses");
  revalidatePath("/office/integrations");
  return { ok: true, message: `${provider.name} connected` };
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

/** Fetch the feed now and import its courses (idempotent — skips duplicates). */
export async function syncIntegrationAction(id: string): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const row = (await repos.tenant.integration.list(ctx, eq(integrationTable.id, id)))[0];
  if (!row) return { ok: false, error: "Not found" };

  try {
    const drafts = await fetchIntegrationDrafts(row);
    const out = await importDrafts(repos, ctx, drafts);
    const summary = `${out.created} added · ${out.duplicates} already in · ${out.skipped} skipped`;
    await repos.tenant.integration.update(ctx, id, { status: "connected", lastSyncedAt: new Date(), lastResult: summary });
    revalidatePath("/office/courses");
    revalidatePath("/office/integrations");
    revalidatePath("/office");
    return { ok: true, message: `Synced — ${summary}` };
  } catch (err) {
    const msg = (err as Error).message || "Sync failed";
    await repos.tenant.integration.update(ctx, id, { status: "error", lastResult: msg });
    revalidatePath("/office/integrations");
    return { ok: false, error: msg };
  }
}
