import { ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { createRepositories } from "@/lib/db/repositories";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { instructor } from "@/lib/db/schema";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { z } from "zod";

/**
 * Fair use on the unlimited plan (decided 5 Oct). "Unlimited" stays true for
 * every ordinary centre: nothing blocks a centre for its size. A centre past
 * the alert level is flagged in the Dev Center so the platform owner can talk
 * to them; the Terms quote `fairUsePeople` as the point we'd agree a plan.
 */
export interface FairUseSettings { fairUsePeople: number; fairUseAlertAt: number; inviteDailyCap: number }

export const fairUseSchema = z.object({
  fairUsePeople: z.coerce.number().int().min(50).max(100_000),
  fairUseAlertAt: z.coerce.number().int().min(10).max(100_000),
  inviteDailyCap: z.coerce.number().int().min(10).max(10_000),
}).refine((v) => v.fairUseAlertAt <= v.fairUsePeople, { message: "The alert level should be at or below the fair use figure", path: ["fairUseAlertAt"] });

export async function fairUseSettings(db: Database): Promise<FairUseSettings> {
  try {
    const p = await new PlatformRepository(db).getPricing();
    return { fairUsePeople: p.fairUsePeople ?? DEFAULT_PRICING.fairUsePeople, fairUseAlertAt: p.fairUseAlertAt ?? DEFAULT_PRICING.fairUseAlertAt, inviteDailyCap: p.inviteDailyCap ?? DEFAULT_PRICING.inviteDailyCap };
  } catch {
    return { fairUsePeople: DEFAULT_PRICING.fairUsePeople, fairUseAlertAt: DEFAULT_PRICING.fairUseAlertAt, inviteDailyCap: DEFAULT_PRICING.inviteDailyCap };
  }
}

/** A centre's headcount, counted the way the Small Club cap counts it (everyone but pending join requests). */
export async function headcount(db: Database, org: { id: string; slug: string }): Promise<number> {
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "fair use headcount" };
  return createRepositories(db).tenant.instructor.count(ctx, ne(instructor.status, "pending"));
}

/** Centres at or over the alert level, biggest first. */
export async function centresOverAlert(db: Database, alertAt: number): Promise<{ id: string; name: string; slug: string; people: number }[]> {
  const orgs = (await new PlatformRepository(db).listOrganisations()).filter((o) => o.status === "active" || o.status === "pending");
  const out: { id: string; name: string; slug: string; people: number }[] = [];
  for (const o of orgs) {
    const people = await headcount(db, o);
    if (people >= alertAt) out.push({ id: o.id, name: o.name, slug: o.slug, people });
  }
  return out.sort((a, b) => b.people - a.people);
}
