import { eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { rosterWeek as rosterWeekTable } from "@/lib/db/schema";
import { weekStart } from "./schedule";

/** Monday (YYYY-MM-DD) of the week a date falls in. */
export const weekOf = (dateIso: string) => weekStart(new Date(`${dateIso}T00:00:00Z`));

/** Weeks the centre has published (Monday → published timestamp). */
export async function publishedWeeks(repos: Repositories, ctx: AnyTenantContext): Promise<Map<string, Date>> {
  const rows = await repos.tenant.rosterWeek.list(ctx);
  return new Map(rows.filter((r) => r.publishedAt).map((r) => [r.weekStart, r.publishedAt!]));
}

export async function isWeekPublished(repos: Repositories, ctx: AnyTenantContext, dateIso: string): Promise<boolean> {
  const rows = await repos.tenant.rosterWeek.list(ctx, eq(rosterWeekTable.weekStart, weekOf(dateIso)));
  return Boolean(rows[0]?.publishedAt);
}
