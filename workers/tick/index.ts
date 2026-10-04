/**
 * The platform's heartbeat, on Cloudflare's own scheduler. Once an hour it calls
 * the app's tick route (email retries, the morning digest, retention and
 * leaving sweeps, trial-survey invitations, outreach). It moved here from a
 * GitHub Actions cron, which was skipping most hours; the GitHub workflow stays
 * as a backup pinger (the tick is idempotent, so two calls do no harm).
 * Deployed by the deploy workflows from workers/tick/wrangler.toml.
 */
export interface Env {
  TICK_URL: string;
  CRON_SECRET: string;
}

async function tick(env: Env): Promise<void> {
  const res = await fetch(env.TICK_URL, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET, "user-agent": "activityroster-tick/1" } });
  if (!res.ok) throw new Error(`tick returned ${res.status}`);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(tick(env));
  },
  // A GET shows the worker is alive; it never runs the tick itself.
  async fetch(): Promise<Response> {
    return new Response("activityroster tick: scheduled hourly", { headers: { "content-type": "text/plain" } });
  },
};
