import { and, eq } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext, SystemTenantContext } from "@/lib/tenant/context";
import { instructor as instructorTable } from "@/lib/db/schema";
import { buildIcs, type IcsEvent } from "@/lib/domain/ics";
import { sessionsForInstructor, staffBySession } from "./session-staff";
import { publishedWeeks, weekOf } from "./roster";
import { addDays } from "./schedule";
import { writeAudit } from "./audit";
import { todayIso } from "@/lib/domain/time";

/**
 * A private calendar (ICS) feed of one instructor's own published shifts
 * (audit A11-2, Part E phase 4). The link is `<orgId>.<secret>`; only a SHA-256
 * of the secret is stored, so the link is shown once and a new one replaces it.
 * The feed carries course, role, time and place only: no colleagues' names,
 * no contact details.
 */

const SECRET_RE = /^[A-Za-z0-9_-]{32}$/;
const ORG_RE = /^[A-Za-z0-9_-]{1,64}$/;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Make (or replace) someone's calendar link. Returns the token to show once. */
export async function issueCalendarToken(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<string | null> {
  const row = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!row || row.anonymisedAt) return null;
  const secret = randomSecret();
  await repos.tenant.instructor.update(ctx, instructorId, { calendarTokenHash: await sha256Hex(secret), calendarTokenCreatedAt: new Date() });
  await writeAudit(repos, ctx, { action: "calendar_feed_issued", entity: "instructor", entityId: instructorId, after: { replaced: Boolean(row.calendarTokenHash) } });
  return `${ctx.organisationId}.${secret}`;
}

/** Switch the feed off: the old link stops working at once. */
export async function revokeCalendarToken(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<boolean> {
  const row = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!row?.calendarTokenHash) return false;
  await repos.tenant.instructor.update(ctx, instructorId, { calendarTokenHash: null, calendarTokenCreatedAt: null });
  await writeAudit(repos, ctx, { action: "calendar_feed_revoked", entity: "instructor", entityId: instructorId });
  return true;
}

/**
 * Who a calendar link belongs to. The centre comes from the link; the person
 * is found inside that centre only (tenant-scoped repository), and only while
 * the centre is active and the person can still be rostered.
 */
export async function resolveCalendarToken(repos: Repositories, token: string): Promise<{ ctx: SystemTenantContext; instructorId: string; orgName: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const orgId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!ORG_RE.test(orgId) || !SECRET_RE.test(secret)) return null;
  const org = await repos.control.organisationById(orgId);
  if (!org || org.status !== "active") return null;
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "calendar-feed" };
  const hash = await sha256Hex(secret);
  const row = (await repos.tenant.instructor.list(ctx, and(eq(instructorTable.calendarTokenHash, hash))))[0];
  if (!row || row.anonymisedAt || row.restrictedAt || row.status !== "active") return null;
  return { ctx, instructorId: row.id, orgName: org.name };
}

/** The feed itself: published shifts from a month back to six months ahead. */
export async function calendarFeedFor(repos: Repositories, ctx: AnyTenantContext, instructorId: string, orgName: string, now: number = Date.now()): Promise<string> {
  const settings = (await repos.tenant.orgSettings.list(ctx))[0];
  const today = todayIso(settings?.timezone ?? undefined, now);
  const from = addDays(today, -31);
  const to = addDays(today, 183);
  const [mine, published, courses, roles, courseLocations, locations] = await Promise.all([
    sessionsForInstructor(repos, ctx, instructorId),
    publishedWeeks(repos, ctx),
    repos.tenant.course.list(ctx),
    repos.tenant.roleType.list(ctx),
    repos.tenant.courseLocation.list(ctx),
    repos.tenant.location.list(ctx),
  ]);
  const shown = mine.filter((s) => s.date >= from && s.date < to && published.has(weekOf(s.date)));
  const members = await staffBySession(repos, ctx, shown);
  const courseName = new Map(courses.map((c) => [c.id, c.name ?? "Course"]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const ms = (v: Date | number) => (v instanceof Date ? v.getTime() : Number(v));
  const events: IcsEvent[] = shown.map((s) => {
    const me = (members.get(s.id) ?? []).find((m) => m.instructorId === instructorId);
    const role = me ? roleName.get(me.roleTypeId) : undefined;
    const places = courseLocations.filter((cl) => cl.courseId === s.courseId).map((cl) => locName.get(cl.locationId)).filter((n): n is string => Boolean(n));
    return {
      uid: `${s.id}@activityroster`,
      startAt: ms(s.startAt),
      endAt: ms(s.endAt),
      summary: `${courseName.get(s.courseId) ?? "Course"}${role ? ` (${role})` : ""}`,
      location: places.join(", ") || null,
      description: `${orgName}${me?.status === "confirmed" ? " · confirmed" : me?.status === "assigned" ? " · please confirm in the app" : ""}`,
    };
  });
  return buildIcs(`${orgName} roster`, events.sort((a, b) => a.startAt - b.startAt), now);
}
