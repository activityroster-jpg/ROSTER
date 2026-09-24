import type { Repositories } from "@/lib/db/repositories";
import { actorUserId, type AnyTenantContext } from "@/lib/tenant/context";
import type { LeaveRequest, LeaveType } from "@/lib/db/schema";
import { writeAudit } from "./audit";

export interface LeaveInput {
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  days: number;
  reason?: string | null;
}

export interface LeaveRow {
  id: string;
  instructorId: string;
  instructorName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: LeaveRequest["status"];
}

/** Raise a leave request for an instructor (defaults to pending). Audited. */
export async function requestLeave(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  input: LeaveInput,
): Promise<LeaveRequest> {
  const row = await repos.tenant.leaveRequest.insert(ctx, {
    instructorId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    days: input.days,
    reason: input.reason ?? null,
    status: "pending",
  });
  await writeAudit(repos, ctx, {
    action: "request_leave",
    entity: "leave_request",
    entityId: row.id,
    after: { instructorId, ...input },
  });
  return row;
}

/** Approve or decline a leave request. Records who decided and when. Audited. */
export async function decideLeave(
  repos: Repositories,
  ctx: AnyTenantContext,
  leaveId: string,
  decision: "approved" | "declined",
): Promise<LeaveRequest | null> {
  const updated = await repos.tenant.leaveRequest.update(ctx, leaveId, {
    status: decision,
    decidedByUserId: actorUserId(ctx),
    decidedAt: new Date(),
  });
  if (!updated) return null;
  await writeAudit(repos, ctx, {
    action: `leave_${decision}`,
    entity: "leave_request",
    entityId: leaveId,
    after: { status: decision },
  });
  return updated;
}

/** All leave requests with instructor names, newest first. */
export async function listLeave(repos: Repositories, ctx: AnyTenantContext): Promise<LeaveRow[]> {
  const [rows, instructors] = await Promise.all([
    repos.tenant.leaveRequest.list(ctx),
    repos.tenant.instructor.list(ctx),
  ]);
  const nameById = new Map(instructors.map((i) => [i.id, i.name]));
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({
      id: r.id,
      instructorId: r.instructorId,
      instructorName: nameById.get(r.instructorId) ?? "Unknown",
      type: r.type,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      reason: r.reason,
      status: r.status,
    }));
}
