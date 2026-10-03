import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getRepositories } from "@/lib/cf/bindings";
import { PUSH_PLATFORMS } from "@/lib/db/schema";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(PUSH_PLATFORMS),
  deviceId: z.string().max(64).optional().nullable(),
});

async function userId(req: Request): Promise<string | null> {
  const s = await (await getAuth()).api.getSession({ headers: new Headers(req.headers) });
  return s?.user?.id ?? null;
}

/** The app registers (POST) or removes (DELETE) this device's push token for the signed-in user. */
export async function POST(req: Request) {
  const limit = await rateLimit(`push-token:${clientIp(req)}`, 30, 60);
  if (!limit.allowed) return tooManyRequests();
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  const { control } = await getRepositories();
  await control.upsertPushToken({ userId: uid, token: parsed.data.token, platform: parsed.data.platform, deviceId: parsed.data.deviceId ?? null });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = z.object({ token: z.string().min(20).max(4096) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  const { control } = await getRepositories();
  // Only the owner may remove a token.
  const mine = (await control.pushTokensForUser(uid)).some((t) => t.token === parsed.data.token);
  if (mine) await control.deletePushToken(parsed.data.token);
  return NextResponse.json({ ok: true });
}
