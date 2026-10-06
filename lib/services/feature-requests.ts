import type { Repositories } from "@/lib/db/repositories";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import type { FeatureRequest, FeatureRequestStatus, Organisation } from "@/lib/db/schema";
import type { TenantContext } from "@/lib/tenant/context";
import { putDocument } from "@/lib/r2";
import { platformAdminEmails } from "@/lib/platform/admin";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { rateLimit } from "@/lib/security/rate-limit";
import { FEATURE_REQUEST_DAILY_CAP, STATUS_INFO, type FeatureRequestInput } from "@/lib/validation/feature-request";
import { writeAudit } from "./audit";

export class FeatureRequestLimitError extends Error {
  constructor() { super(`Your centre has sent ${FEATURE_REQUEST_DAILY_CAP} requests today. Please send the rest tomorrow, or add them to one you've already sent.`); }
}

const oneLine = (s: string, max = 80) => s.replace(/[\r\n]+/g, " ").slice(0, max);

/**
 * Store a centre's request, attach its private screenshot (org-prefixed in R2,
 * so only that centre and the Dev Center can ever fetch it), log it in the
 * centre's audit log and tell the platform owner. The request starts as
 * "submitted": nobody else sees it until it has been read and moved on.
 */
export async function submitFeatureRequest(
  repos: Repositories,
  ctx: TenantContext,
  input: { organisation: Organisation; answers: FeatureRequestInput; submitterName: string | null; screenshot?: { body: ArrayBuffer; contentType: string } | null },
): Promise<FeatureRequest> {
  const fr = new FeatureRequestRepository(repos.db);
  if ((await fr.countSince(ctx, new Date(Date.now() - 86_400_000))) >= FEATURE_REQUEST_DAILY_CAP) throw new FeatureRequestLimitError();

  const a = input.answers;
  const row = await fr.create(ctx, {
    submittedByUserId: ctx.userId,
    submitterName: input.submitterName,
    kind: a.kind,
    title: a.title,
    problem: a.problem,
    change: a.change,
    whoAffected: a.whoAffected,
    frequency: a.frequency,
    workaround: a.workaround,
    importance: a.importance,
    details: a.details,
    consentPublic: true,
  });

  let screenshotKey: string | null = null;
  if (input.screenshot) {
    const ext = input.screenshot.contentType.split("/")[1] ?? "img";
    screenshotKey = await putDocument(ctx, `feature-requests/${row.id}/screenshot.${ext}`, input.screenshot.body, { contentType: input.screenshot.contentType });
    await fr.setScreenshotKey(ctx, row.id, screenshotKey);
  }

  await writeAudit(repos, ctx, { action: "create", entity: "feature_request", entityId: row.id, after: { kind: row.kind, title: row.title, screenshot: Boolean(screenshotKey) } });

  // Tell the platform owner(s); capped so a burst can't flood the inbox (everything is still in the Dev Center).
  try {
    const admins = [...platformAdminEmails()];
    const cap = await rateLimit("feature-request:mail:global", 30, 60 * 60);
    if (admins.length && cap.allowed) {
      const html = `
        <p><strong>New ${row.kind === "problem" ? "problem report" : "feature request"} from ${escapeHtml(input.organisation.name)}</strong></p>
        <p><strong>${escapeHtml(row.title)}</strong></p>
        <p><strong>The problem:</strong><br>${escapeHtml(row.problem)}</p>
        <p><strong>What they'd change:</strong><br>${escapeHtml(row.change)}</p>
        <p><strong>How much it matters:</strong> ${escapeHtml(row.importance)}${screenshotKey ? " · screenshot attached in the Dev Center" : ""}</p>
        <p style="color:#64748b;font-size:12px">Read the full brief and move it on at /admin/requests. It stays private to the centre until you move it to In review.</p>`;
      await Promise.all(admins.map((to) => sendEmail({ to, subject: `💡 Request from ${oneLine(input.organisation.name)}: ${oneLine(row.title, 60)}`, html }).catch(() => {})));
    }
  } catch (err) {
    console.error("[feature-requests] owner email failed:", (err as Error).message);
  }
  return row;
}

/** Email the person who sent a request when it moves to a new stage. Best-effort. */
export async function emailStatusChange(to: string, opts: { centreName: string; title: string; status: FeatureRequestStatus; response: string | null; officeUrl: string }): Promise<void> {
  const info = STATUS_INFO[opts.status];
  const html = `
    <p>Your request <strong>${escapeHtml(opts.title)}</strong> is now <strong>${escapeHtml(info.label)}</strong>.</p>
    <p>${escapeHtml(info.hint)}</p>
    ${opts.response ? `<p><strong>A note from us:</strong><br>${escapeHtml(opts.response)}</p>` : ""}
    <p><a href="${escapeHtml(opts.officeUrl)}">See all your requests</a></p>`;
  try {
    await sendEmail({ to, subject: `Your request is ${info.label.toLowerCase()}: ${oneLine(opts.title, 60)}`, html });
  } catch (err) {
    console.error("[feature-requests] status email failed:", (err as Error).message);
  }
}
