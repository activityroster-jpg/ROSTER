/**
 * The platform's heartbeat, on Cloudflare's own scheduler. Once an hour it calls
 * the app's tick route (email retries, the morning digest, retention and
 * leaving sweeps, trial-survey invitations, outreach). It moved here from a
 * GitHub Actions cron, which was skipping most hours; the GitHub workflow stays
 * as a backup pinger (the tick is idempotent, so two calls do no harm).
 * Every two minutes it also calls the delivery job, which sends queued emails
 * and phone notifications (bulk notices such as a published week).
 * Deployed by the deploy workflows from workers/tick/wrangler.toml.
 */
export interface Env {
  TICK_URL: string;
  DRAIN_URL: string;
  CRON_SECRET: string;
}

const EVERY_TWO_MINUTES = "*/2 * * * *";

async function call(url: string, env: Env): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET, "user-agent": "activityroster-tick/1" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(event.cron === EVERY_TWO_MINUTES ? call(env.DRAIN_URL, env) : call(env.TICK_URL, env));
  },
  // A GET shows the worker is alive; it never runs the tick itself.
  async fetch(): Promise<Response> {
    return new Response("activityroster tick: hourly tick, and delivery every two minutes", { headers: { "content-type": "text/plain" } });
  },
};
