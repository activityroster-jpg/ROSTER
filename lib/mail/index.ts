import { getEnv } from "@/lib/cf/bindings";
import { COMPANY } from "@/lib/config";

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

/**
 * Wrap a message body in the branded ActivityRoster email shell: a logo/wordmark
 * header and a legally-aware footer (sender identity, why they got it, postal
 * address when configured, and privacy/terms links). All emails go through this.
 */
export function renderEmail(bodyHtml: string): string {
  const env = getEnv();
  const apex = env.APP_APEX_DOMAIN || "activityroster.com";
  const site = `https://${apex}`;
  const legalName = env.COMPANY_LEGAL_NAME || COMPANY.legalName;
  const support = env.SUPPORT_EMAIL || `support@${apex}`;
  const year = new Date().getFullYear();
  const addressText = env.COMPANY_ADDRESS || COMPANY.addressInline;
  const address = addressText ? `<div style="margin-top:4px">${addressText}</div>` : "";

  return `
  <div style="margin:0;padding:0;background:#f1f5f9">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
      <div style="text-align:center;padding:8px 0 16px">
        <a href="${site}" style="text-decoration:none;color:#0A2E52;font-size:20px;font-weight:800;letter-spacing:-0.01em">⛵ ActivityRoster</a>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;font-size:15px;line-height:1.55;color:#334155">
        ${bodyHtml}
      </div>
      <div style="padding:16px 8px 8px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6">
        <div style="font-weight:600;color:#64748b">${legalName}</div>
        <div>Staff rostering &amp; course administration for RYA sailing &amp; watersports centres.</div>
        ${address}
        <div style="margin-top:8px">
          <a href="${site}" style="color:#0C6B74;text-decoration:none">Website</a> ·
          <a href="${site}/privacy" style="color:#0C6B74;text-decoration:none">Privacy</a> ·
          <a href="${site}/terms" style="color:#0C6B74;text-decoration:none">Terms</a> ·
          <a href="mailto:${support}" style="color:#0C6B74;text-decoration:none">${support}</a>
        </div>
        <div style="margin-top:8px">You're receiving this service email because you have an ActivityRoster account or a centre invited you. This is a transactional message about your account, not marketing.</div>
        <div style="margin-top:6px">© ${year} ${legalName}. All rights reserved.</div>
      </div>
    </div>
  </div>`;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const env = getEnv();
  const from = msg.from ?? "ActivityRoster <no-reply@activityroster.com>";
  const html = renderEmail(msg.html);

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
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html }),
  });

  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}
