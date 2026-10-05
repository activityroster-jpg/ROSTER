import { NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { researchBatch, runDueSends } from "@/lib/outreach/engine";
import { sendDailyDigests } from "@/lib/services/digest";
import { sweepLeaving } from "@/lib/services/leaving";
import { sweepTrialSurvey } from "@/lib/services/trial-survey";
import { drainEmailQueue } from "@/lib/mail/queue";
import { sweepRetention } from "@/lib/services/retention";
import { sweepInviteReminders } from "@/lib/services/invite-reminders";
import { sweepQueuedInvites } from "@/lib/auth/invite-link";
import { createRepositories } from "@/lib/db/repositories";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { checkCronSecret } from "@/lib/security/cron-secret";

export const dynamic = "force-dynamic";

/**
 * The agent's heartbeat. OpenNext has no cron, so an external pinger calls this
 * hourly (see docs/outreach.md) with the shared secret. Each tick researches a
 * small batch of new leads per running campaign and sends whatever is due, both
 * bounded so a single request stays well inside Worker CPU limits.
 */
async function tick(req: Request) {
  const limit = await rateLimit(`outreach-tick:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return tooManyRequests();
  const env = getEnv();
  if (!checkCronSecret(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = await getDb();
  const p = new PlatformRepository(db);
  const running = (await p.listOutreachCampaigns()).filter((c) => c.status === "running");
  const research: Record<string, { researched: number; queued: number; noEmail: number }> = {};
  for (const c of running) research[c.id] = await researchBatch(db, env, c.id, 10);
  const sends = await runDueSends(db, env, { limit: 25 });
  // Centre-side jobs ride the same heartbeat: the opt-in morning roster digest.
  const digests = await sendDailyDigests(db, env).catch((e: Error) => ({ checked: 0, sent: 0, skipped: 0, error: e.message }));
  // Leaving centres: 14-day reminder and the "ready to erase" note to the owner.
  const leaving = await sweepLeaving(db, env).catch((e: Error) => ({ checked: 0, reminded: 0, due: 0, error: e.message }));
  // Trial ended without a plan: invite the admins once to the survey that earns another free month.
  const trialSurvey = await sweepTrialSurvey(db, env).catch((e: Error) => ({ checked: 0, sent: 0, error: e.message }));
  // Invitations nobody has answered after a day: one reminder each.
  const inviteReminders = await sweepInviteReminders(db, env).catch((e: Error) => ({ due: 0, sent: 0, error: e.message }));
  // Invitations a centre's daily cap held back (fair use): they go once the new day's allowance opens.
  const queuedInvites = await sweepQueuedInvites(createRepositories(db)).catch((e: Error) => ({ queued: 0, sent: 0, held: 0, failed: 0, error: e.message }));
  // Email retries: anything that failed for a passing reason goes again with backoff.
  const mail = await drainEmailQueue(db, env).catch((e: Error) => ({ due: 0, sent: 0, failed: 0, purged: 0, error: e.message }));
  // Data retention: one sweep per centre per day, with the 14-day notice first.
  const rateLimitsPurged = await new ControlPlaneRepository(db).purgeRateLimits().catch(() => 0);
  const retention = await sweepRetention(db, env).catch((e: Error) => ({ centres: 0, ran: 0, reminded: 0, platform: {}, error: e.message }));
  return NextResponse.json({ ok: true, campaigns: running.length, research, sends, digests, leaving, trialSurvey, inviteReminders, queuedInvites, mail, retention, rateLimitsPurged });
}

export async function POST(req: Request) { return tick(req); }
export async function GET(req: Request) { return tick(req); }
