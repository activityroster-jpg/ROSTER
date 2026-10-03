import { NextResponse } from "next/server";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { privacyRequestSchema } from "@/lib/validation/privacy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { platformAdminEmails } from "@/lib/platform/admin";
import { PRIVACY_CONTACT } from "@/lib/legal";
import { verifyTurnstile } from "@/lib/security/turnstile";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  access: "copy of my data", correction: "correction", erasure: "deletion", restriction: "restriction of processing",
  portability: "data export", objection: "objection to processing", complaint: "complaint", other: "other request",
};

/**
 * Public data-protection request / complaint form. Stored with a 30-day
 * acknowledgement deadline, the requester gets an immediate receipt, and the
 * platform owner is emailed. Rate-limited and validated; the honeypot field
 * silently drops bots.
 */
export async function POST(req: Request) {
  const limit = await rateLimit(`privacy-request:${clientIp(req)}`, 5, 60 * 60);
  if (!limit.allowed) return tooManyRequests();
  const raw = (await req.json().catch(() => null)) as (Record<string, unknown> & { turnstileToken?: string }) | null;
  const human = await verifyTurnstile(raw?.turnstileToken, clientIp(req));
  if (!human.ok) return NextResponse.json({ error: human.reason }, { status: 400 });
  const parsed = privacyRequestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true, reference: "received" });

  const repo = new PlatformRepository(await getDb());
  const row = await repo.insertPrivacyRequest({
    kind: d.kind, name: d.name, email: d.email, centre: d.centre || null, message: d.message,
    status: "new", dueAt: new Date(Date.now() + 30 * 86_400_000), acknowledgedAt: null, closedAt: null, notes: null,
  });
  const ref = row.id.slice(0, 8).toUpperCase();

  await sendEmail({
    to: d.email,
    subject: `We've received your ${KIND_LABEL[d.kind] ?? "request"} (ref ${ref})`,
    html: `<p>Hi ${escapeHtml(d.name)},</p><p>Thanks for getting in touch. We've logged your ${escapeHtml(KIND_LABEL[d.kind] ?? "request")} under reference <strong>${ref}</strong> and will reply within 30 days, usually much sooner.</p><p>If your request is about a sailing centre's records (for example your staff profile at a club), that centre is the data controller and we may pass the request to them or ask them to respond; we'll tell you if so.</p><p>You can reply to this email or write to ${PRIVACY_CONTACT} at any time.</p>`,
  }).catch(() => {});
  const admins = [...platformAdminEmails()];
  if (admins.length) {
    await Promise.all(admins.map((to) => sendEmail({
      to,
      subject: `Privacy request: ${KIND_LABEL[d.kind] ?? d.kind} (ref ${ref}) · due in 30 days`,
      html: `<p><strong>${escapeHtml(d.name)}</strong> &lt;${escapeHtml(d.email)}&gt;${d.centre ? ` · ${escapeHtml(d.centre)}` : ""}</p><p>${escapeHtml(d.message).replace(/\n/g, "<br>")}</p><p>Handle it in the Dev Center → Privacy.</p>`,
    }).catch(() => {})));
  }
  return NextResponse.json({ ok: true, reference: ref });
}
