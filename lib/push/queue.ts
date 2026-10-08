import type { Database } from "@/lib/db/client";
import type { CloudflareEnv } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";
import { sendPush } from "./fcm";

/**
 * Send queued phone notifications (bulk notices such as a published week).
 * Run every couple of minutes by the delivery job; each run sends a bounded
 * number, a few at a time, so it stays inside Cloudflare's per-request limits.
 * A person with no registered phone simply has nothing to send.
 */
export async function drainPushQueue(db: Database, env: CloudflareEnv, limit = 200): Promise<{ due: number; sent: number; dead: number }> {
  const p = new PlatformRepository(db);
  const control = new ControlPlaneRepository(db);
  const due = await p.duePushes(limit);
  if (due.length === 0) return { due: 0, sent: 0, dead: 0 };
  const tokens = new Map<string, string[]>();
  for (const t of await control.pushTokensForUsers([...new Set(due.map((d) => d.userId))])) tokens.set(t.userId, [...(tokens.get(t.userId) ?? []), t.token]);
  const dead: string[] = [];
  let sent = 0;
  for (let i = 0; i < due.length; i += 6) {
    await Promise.all(due.slice(i, i + 6).map(async (d) => {
      const mine = tokens.get(d.userId) ?? [];
      if (mine.length === 0) return;
      const r = await sendPush(env, mine, { title: d.title, body: d.body, url: d.url ?? "/portal/notifications" });
      sent += r.sent;
      dead.push(...r.dead);
    }));
  }
  await p.markPushes(due.map((d) => d.id), "sent");
  await Promise.all(dead.map((t) => control.deletePushToken(t).catch(() => {})));
  return { due: due.length, sent, dead: dead.length };
}
