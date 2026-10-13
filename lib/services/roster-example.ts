import type { Repositories } from "@/lib/db/repositories";
import type { Organisation } from "@/lib/db/schema";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { listDocuments, putDocument, tenantKey } from "@/lib/r2";
import { escapeHtml, sendEmail } from "@/lib/mail";
import { platformAdminEmails } from "@/lib/platform/admin";
import { apexDomain } from "@/lib/config";
import { writeAudit } from "./audit";

/**
 * A centre's example of the roster it uses today (a PDF or photo), uploaded in
 * setup or under Settings → Roster PDF, so we can shape its downloadable roster
 * to look the same. Kept in the centre's own private file space; the Dev Center
 * is told and can open it. A roster lists staff names, so it is personal data:
 * it never leaves the centre's namespace except to the platform admin.
 */
export const ROSTER_EXAMPLE_PREFIX = "roster-example/";
export const ROSTER_EXAMPLE_MAX_BYTES = 10 * 1024 * 1024;
const KEEP = 5;

export interface RosterExample { key: string; name: string; uploadedAt: string; size: number }

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._ -]/g, "").trim().slice(0, 80) || "roster";

/** The centre's uploaded examples, newest first. */
export async function listRosterExamples(ctx: AnyTenantContext): Promise<RosterExample[]> {
  const page = await listDocuments(ctx, ROSTER_EXAMPLE_PREFIX);
  return page.objects
    .map((o) => ({ key: o.key, name: o.key.split("/").pop()?.replace(/^\d+-/, "") ?? "roster", uploadedAt: o.uploaded.toISOString(), size: o.size }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Is this key one of the centre's roster examples? (For the Dev Center download.) */
export function isRosterExampleKey(ctx: AnyTenantContext, key: string): boolean {
  return key.startsWith(tenantKey(ctx, ROSTER_EXAMPLE_PREFIX)) && !key.includes("..");
}

export async function saveRosterExample(
  repos: Repositories,
  ctx: AnyTenantContext,
  organisation: Pick<Organisation, "id" | "name">,
  file: { filename: string; contentType: string; body: ArrayBuffer },
): Promise<{ ok: true; example: RosterExample } | { ok: false; error: string }> {
  if ((await listRosterExamples(ctx)).length >= KEEP) return { ok: false, error: `You've sent ${KEEP} examples already. That's plenty for us to work from.` };
  const name = safeName(file.filename);
  const key = await putDocument(ctx, `${ROSTER_EXAMPLE_PREFIX}${Date.now()}-${name}`, file.body, { contentType: file.contentType });
  await writeAudit(repos, ctx, { action: "roster_example_uploaded", entity: "org_settings", after: { file: name, bytes: file.body.byteLength } });

  // Let the platform admin know, so the centre's roster PDF can be tailored.
  const admins = [...platformAdminEmails()];
  const link = `https://${apexDomain()}/admin/centres/${organisation.id}`;
  await Promise.all(admins.map((to) => sendEmail({
    to,
    subject: `${organisation.name} sent an example of their roster`,
    html: `<p><strong>${escapeHtml(organisation.name)}</strong> uploaded an example of the roster they use today, so their downloadable roster can be made to match it.</p>
<p><a href="${link}">Open the centre in the Dev Center</a> to download it (under "Roster example").</p>`,
  }).catch(() => {})));

  return { ok: true, example: { key, name, uploadedAt: new Date().toISOString(), size: file.body.byteLength } };
}
