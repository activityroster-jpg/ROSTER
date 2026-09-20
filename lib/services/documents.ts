import type { Repositories } from "@/lib/db/repositories";
import type { TenantContext } from "@/lib/tenant/context";
import { putDocument } from "@/lib/r2";
import { writeAudit } from "./audit";

export type DocumentKind = "compliance" | "qualification";

export interface AttachDocumentInput {
  kind: DocumentKind;
  itemId: string;
  filename: string;
  contentType?: string;
  body: ArrayBuffer;
}

export type AttachResult = { ok: true; docKey: string } | { ok: false; error: string };

/** Filenames are sanitised to a safe leaf before becoming part of an R2 key. */
function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

/**
 * Attach an uploaded document to a compliance item or qualification and stamp
 * its `docKey`. The R2 key is org-scoped by `putDocument` (org_{id}/…), so a
 * file can only ever land in the caller's tenant namespace.
 *
 * `restrictToInstructorId` (set for the instructor portal) enforces that the
 * target record belongs to that instructor — an instructor can only upload
 * against their own tickets/checks.
 */
export async function attachDocument(
  repos: Repositories,
  ctx: TenantContext,
  input: AttachDocumentInput,
  restrictToInstructorId?: string,
): Promise<AttachResult> {
  const repo = input.kind === "compliance" ? repos.tenant.complianceItem : repos.tenant.qualification;
  const item = await repo.findById(ctx, input.itemId);
  if (!item) return { ok: false, error: "Record not found" };
  if (restrictToInstructorId && item.instructorId !== restrictToInstructorId) {
    return { ok: false, error: "You can only upload against your own records" };
  }

  const relPath = `instructor_${item.instructorId}/${input.kind}/${input.itemId}/${safeName(input.filename)}`;
  const docKey = await putDocument(ctx, relPath, input.body, {
    contentType: input.contentType ?? "application/octet-stream",
  });

  await repo.update(ctx, input.itemId, { docKey });
  await writeAudit(repos, ctx, {
    action: "attach_document",
    entity: input.kind === "compliance" ? "compliance_item" : "qualification",
    entityId: input.itemId,
    after: { docKey },
  });

  return { ok: true, docKey };
}
