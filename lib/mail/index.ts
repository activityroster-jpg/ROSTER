import { getEnv } from "@/lib/cf/bindings";

/**
 * Minimal transactional mailer. Uses Resend's HTTP API (fetch-only, no Node
 * SDK) so it runs on Workers. In non-production or without a key it logs instead
 * of sending, so local/dev flows still work.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const env = getEnv();
  const from = msg.from ?? "ActivityRoster <no-reply@activityroster.com>";

  if (!env.RESEND_API_KEY || env.APP_ENV !== "production") {
    console.info(`[mail] (not sent: ${env.APP_ENV}) → ${msg.to}: ${msg.subject}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
  });

  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}
