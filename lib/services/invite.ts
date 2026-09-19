import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { writeAudit } from "./audit";

export type InviteResult =
  | { ok: true; email: string; created: boolean }
  | { ok: false; error: string };

/**
 * Link an instructor record to an auth user so they can use the portal:
 *   - ensure a user exists for the instructor's email,
 *   - ensure an active `instructor` membership in this org,
 *   - stamp instructor.userId.
 * Idempotent, tenant scoped, audited. The magic-link email is sent by the
 * caller (it needs the request-scoped auth instance).
 */
export async function linkInstructorUser(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<InviteResult> {
  const instructor = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!instructor) return { ok: false, error: "Instructor not found" };
  if (!instructor.email) return { ok: false, error: "Add an email to this instructor first" };

  const email = instructor.email.toLowerCase();
  const existingUser = await repos.control.userByEmail(email);
  const user = existingUser ?? (await repos.control.createUser({ name: instructor.name, email }));

  const membership = await repos.control.activeMembership(user.id, ctx.organisationId);
  if (!membership) {
    await repos.control.createMembership({ userId: user.id, organisationId: ctx.organisationId, role: "instructor" });
  }

  if (instructor.userId !== user.id) {
    await repos.tenant.instructor.update(ctx, instructorId, { userId: user.id });
  }

  await writeAudit(repos, ctx, {
    action: "invite_instructor",
    entity: "instructor",
    entityId: instructorId,
    after: { email, userId: user.id },
  });

  return { ok: true, email, created: !existingUser };
}
