import { and, eq, isNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { notification as notificationTable, type Notification } from "@/lib/db/schema";
import { sendEmail } from "@/lib/mail";

export interface NotifyInput {
  title: string;
  body?: string | null;
  /** Also send an email to the instructor if they have an address. */
  email?: boolean;
}

/**
 * Notify an instructor: always writes an in-app notification (visible in the
 * portal), and optionally sends a best-effort email. Tenant scoped. Never
 * throws on email failure — the in-app record is the source of truth.
 */
export async function notifyInstructor(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
  input: NotifyInput,
): Promise<Notification | null> {
  const instructor = await repos.tenant.instructor.findById(ctx, instructorId);
  if (!instructor) return null;

  const row = await repos.tenant.notification.insert(ctx, {
    userId: instructor.userId ?? null,
    instructorId,
    channel: "in_app",
    title: input.title,
    body: input.body ?? null,
    readAt: null,
    sentAt: new Date(),
  });

  if (input.email && instructor.email) {
    try {
      await sendEmail({
        to: instructor.email,
        subject: input.title,
        html: `<p>${escapeHtml(input.title)}</p>${input.body ? `<p>${escapeHtml(input.body)}</p>` : ""}<p style="color:#64748b;font-size:12px">Sent by ActivityRoster</p>`,
      });
    } catch (err) {
      console.error("[notify] email failed:", (err as Error).message);
    }
  }
  return row;
}

/** An instructor's notifications, newest first. */
export async function listForInstructor(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<Notification[]> {
  const rows = await repos.tenant.notification.list(ctx, eq(notificationTable.instructorId, instructorId));
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Count unread notifications for an instructor. */
export async function unreadCount(
  repos: Repositories,
  ctx: AnyTenantContext,
  instructorId: string,
): Promise<number> {
  return repos.tenant.notification.count(
    ctx,
    and(eq(notificationTable.instructorId, instructorId), isNull(notificationTable.readAt))!,
  );
}

/** Mark one notification read (scoped to the tenant). */
export async function markRead(repos: Repositories, ctx: AnyTenantContext, id: string): Promise<void> {
  await repos.tenant.notification.update(ctx, id, { readAt: new Date() });
}

/** Mark all of an instructor's unread notifications read. */
export async function markAllRead(repos: Repositories, ctx: AnyTenantContext, instructorId: string): Promise<number> {
  const unread = await repos.tenant.notification.list(
    ctx,
    and(eq(notificationTable.instructorId, instructorId), isNull(notificationTable.readAt))!,
  );
  const now = new Date();
  for (const n of unread) await repos.tenant.notification.update(ctx, n.id, { readAt: now });
  return unread.length;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
