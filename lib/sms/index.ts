import { getEnv, type CloudflareEnv } from "@/lib/cf/bindings";

/**
 * Text messages (Twilio REST over fetch, Workers-friendly). Used only for the
 * text-message second step. TWILIO_FROM may be a phone number or a Messaging
 * Service SID (MG…). When the three variables are missing the option is simply
 * not offered in the UI.
 */
export function smsConfigured(env: CloudflareEnv = getEnv()): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
}

export async function sendSms({ to, body }: { to: string; body: string }, env: CloudflareEnv = getEnv()): Promise<void> {
  if (!smsConfigured(env)) throw new Error("Text messages are not set up (TWILIO_* variables missing)");
  const sid = env.TWILIO_ACCOUNT_SID!;
  const from = env.TWILIO_FROM!;
  const form = new URLSearchParams({ To: to, Body: body.slice(0, 320) });
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from);
  else form.set("From", from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`)}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
