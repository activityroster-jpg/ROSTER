"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant/require";
import { integration as integrationTable, INTEGRATION_KINDS, type IntegrationKind } from "@/lib/db/schema";
import { providerById } from "@/lib/integrations/catalogue";
import { syncIcsFeed } from "@/lib/services/integrations";
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
/** webcal:// is just ICS over http(s) — normalise for fetch. */
function toFetchUrl(url: string): string {
  const t = url.trim();
  return t.startsWith("webcal://") ? "https://" + t.slice("webcal://".length) : t;
}

/** Connect (or update) a booking system via its calendar feed URL. One row per provider. */
export async function connectIntegrationAction(input: { provider: string; kind?: string; feedUrl: string }): Promise<IntegrationResult> {
  const { ctx, repos } = await requireTenant({ role: "admin" });
  const provider = providerById(input.provider);
  if (!provider) return { ok: false, error: "Unknown provider" };
  const kind: IntegrationKind = (INTEGRATION_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as IntegrationKind) : "ics";
  const feedUrl = (input.feedUrl ?? "").trim();
  if (kind === "ics" && !validFeedUrl(feedUrl)) return { ok: false, error: "Enter a valid calendar feed URL (https://…)" };

  const existing = (await repos.tenant.integration.list(ctx, eq(integrationTable.provider, input.provider)))[0];
  if (existing) {
    await repos.tenant.integration.update(ctx, existing.id, { kind, feedUrl, status: "connected", lastResult: null });
  } else {
    await repos.tenant.integration.insert(ctx, { provider: input.provider, kind, feedUrl, status: "connected" });
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
  if (!row.feedUrl) return { ok: false, error: "No calendar feed URL set — reconnect with a feed URL" };

  try {
    const res = await fetch(toFetchUrl(row.feedUrl), { headers: { Accept: "text/calendar, text/plain, */*" } });
    if (!res.ok) throw new Error(`Feed responded ${res.status}`);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That URL didn't return a calendar (ICS) feed");

    const out = await syncIcsFeed(repos, ctx, text);
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
