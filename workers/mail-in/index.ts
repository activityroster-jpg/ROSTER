/**
 * Receipts by email. Cloudflare Email Routing hands each message sent to the
 * books' private address (receipts-<token>@activityroster.com, shown in Dev
 * Center → Finance → Receipt inbox) to this worker, which passes it untouched to
 * the app. The app checks the address and the sender, and stores, reads and
 * matches the receipt. Deployed by the deploy workflows from
 * workers/mail-in/wrangler.toml. Secret: CRON_SECRET, the app's
 * OUTREACH_CRON_SECRET, set by the deploy workflows.
 */
export interface Env {
  INBOUND_URL: string;
  CRON_SECRET: string;
}

interface InboundEmail {
  readonly from: string;
  readonly to: string;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}

export default {
  async email(message: InboundEmail, env: Env): Promise<void> {
    const raw = await new Response(message.raw).arrayBuffer();
    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "content-type": "message/rfc822",
        "x-cron-secret": env.CRON_SECRET,
        "x-envelope-from": message.from,
        "x-envelope-to": message.to,
        "user-agent": "activityroster-mail-in/1",
      },
      body: raw,
    });
    if (res.status === 404) { message.setReject("No such mailbox"); return; }
    if (res.status === 413) { message.setReject("Message too large"); return; }
    // Anything else unexpected: fail, so the sending server tries again later.
    if (!res.ok) throw new Error(`inbound returned ${res.status}`);
  },
  async fetch(): Promise<Response> {
    return new Response("activityroster mail-in: receipts by email", { headers: { "content-type": "text/plain" } });
  },
};
