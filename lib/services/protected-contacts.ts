import type { Repositories } from "@/lib/db/repositories";
import type { TenantContext } from "@/lib/tenant/context";
import { openToken } from "@/lib/security/token-crypto";
import { writeAudit } from "./audit";

export interface ProtectedContacts {
  guardianName: string; guardianPhone: string; guardianEmail: string;
  emergencyName: string; emergencyPhone: string; emergencyRelationship: string;
}

/** Decrypt the guardian and emergency contacts for the admin staff page, recording that they were viewed. */
export async function readProtectedContacts(
  repos: Repositories,
  ctx: TenantContext,
  instructor: { id: string; guardianName: string | null; guardianPhone: string | null; guardianEmail: string | null; emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null },
): Promise<ProtectedContacts> {
  const out: ProtectedContacts = {
    guardianName: instructor.guardianName ?? "",
    guardianPhone: (await openToken(instructor.guardianPhone)) ?? "",
    guardianEmail: (await openToken(instructor.guardianEmail)) ?? "",
    emergencyName: (await openToken(instructor.emergencyName)) ?? "",
    emergencyPhone: (await openToken(instructor.emergencyPhone)) ?? "",
    emergencyRelationship: instructor.emergencyRelationship ?? "",
  };
  if (Object.values(out).some(Boolean)) {
    await writeAudit(repos, ctx, { action: "view_protected_contacts", entity: "instructor", entityId: instructor.id }).catch(() => {});
  }
  return out;
}
