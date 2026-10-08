import { and, eq, isNull } from "drizzle-orm";
import type { Repositories } from "@/lib/db/repositories";
import type { AnyTenantContext } from "@/lib/tenant/context";
import { instructor as instructorTable, notification as notificationTable, type Notification } from "@/lib/db/schema";
import { queueEmails, sendEmail } from "@/lib/mail";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { getEnv } from "@/lib/cf/bindings";
import { sendPush } from "@/lib/push/fcm";

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
  // Restricted or anonymised people are not contacted (GDPR art. 18 restriction; nothing to send to after anonymisation).
  if (instructor.restrictedAt || instructor.anonymisedAt) return null;

  const row = await repos.tenant.notification.insert(ctx, {
    userId: instructor.userId ?? null,
    instructorId,
    channel: "in_app",
    title: input.title,
    body: input.body ?? null,
    readAt: null,
    sentAt: new Date(),
  });

  // Push to the instructor's phones (the app registers tokens per device). Best effort.
  if (instructor.userId) {
    try {
      const tokens = await repos.control.pushTokensForUser(instructor.userId);
      if (tokens.length) {
        const { dead } = await sendPush(getEnv(), tokens.map((t) => t.token), { title: input.title, body: input.body ?? null, url: "/portal/notifications" });
        await Promise.all(dead.map((t) => repos.control.deletePushToken(t).catch(() => {})));
      }
    } catch (err) {
      console.error("[notify] push failed:", (err as Error).message);
    }
  }

  if (input.email && instructor.email && instructor.notifyEmail !== false) {
    try {
      await sendEmail({
        to: instructor.email,
        subject: input.title,
        html: noticeHtml(input),
      });
    } catch (err) {
      console.error("[notify] email failed:", (err as Error).message);
    }
  }
  return row;
}

const noticeHtml = (input: NotifyInput) => `<p>${escapeHtml(input.title)}</p>${input.body ? `<p>${escapeHtml(input.body)}</p>` : ""}<p style="color:#64748b;font-size:12px">Sent by ActivityRoster</p>`;

/**
 * Notify many instructors at once (publishing a week), each with their own
 * notice, in a fixed handful of queries however many people there are: the
 * in-app notifications are written in batches straight away, and the emails
 * and phone pushes are queued for the delivery job, which sends them within a
 * couple of minutes. Same rules as {@link notifyInstructor}: restricted or
 * anonymised people are skipped; email only to an address whose owner hasn't
 * switched email off. Returns how many people were notified.
 */
export async function notifyInstructors(
  repos: Repositories,
  ctx: AnyTenantContext,
  items: { instructorId: string; input: NotifyInput }[],
): Promise<number> {
  if (items.length === 0) return 0;
  const people = new Map((await repos.tenant.instructor.listIn(ctx, instructorTable.id, items.map((i) => i.instructorId))).map((p) => [p.id, p]));
  const live = items.flatMap((i) => {
    const p = people.get(i.instructorId);
    return p && !p.restrictedAt && !p.anonymisedAt ? [{ p, input: i.input }] : [];
  });
  const now = new Date();
  await repos.tenant.notification.insertMany(ctx, live.map(({ p, input }) => ({ userId: p.userId ?? null, instructorId: p.id, channel: "in_app" as const, title: input.title, body: input.body ?? null, readAt: null, sentAt: now })));

  const pushes = live.flatMap(({ p, input }) => (p.userId ? [{ userId: p.userId, title: input.title, body: input.body ?? null, url: "/portal/notifications" }] : []));
  try {
    if (pushes.length) await new PlatformRepository(repos.db).enqueuePushes(pushes);
  } catch (err) {
    console.error("[notify] queueing pushes failed:", (err as Error).message);
  }
  const emails = live.flatMap(({ p, input }) => (input.email && p.email && p.notifyEmail !== false ? [{ to: p.email, subject: input.title, html: noticeHtml(input) }] : []));
  try {
    if (emails.length) await queueEmails(emails);
  } catch (err) {
    console.error("[notify] queueing emails failed:", (err as Error).message);
  }
  return live.length;
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
