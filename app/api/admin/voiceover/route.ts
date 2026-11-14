import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getEnv } from "@/lib/cf/bindings";
import { TAKE_MAX_BYTES, appliedKey, isVoiceoverFile, sniffAudio, startApplyRun, takeKey, takeMetaKey, voicedVideoKey, type TakeMeta } from "@/lib/videos/voiceover";

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Play back the saved recording for a video (Dev Center only). */
export async function GET(req: Request) {
  await requirePlatformAdmin();
  const file = new URL(req.url).searchParams.get("file");
  if (!isVoiceoverFile(file)) return bad("Unknown video", 404);
  const obj = await getEnv().DOCS.get(takeKey(file));
  if (!obj) return bad("No recording yet", 404);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

const meta = z.object({ file: z.string(), offsetMs: z.coerce.number().int().min(-10_000).max(30_000) });

/**
 * Save a recording (replacing the last one for that video) and start the
 * Action that puts it on the video. `action=apply` only starts the Action again.
 * The audio type is read from its bytes; the key is built from the video's own name.
 */
export async function POST(req: Request) {
  await requirePlatformAdmin();
  const env = getEnv();
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Send the recording as a form");
  const file = form.get("file");
  if (!isVoiceoverFile(file)) return bad("Unknown video", 404);

  if (form.get("action") === "apply") {
    if (!(await env.DOCS.head(takeMetaKey(file)))) return bad("No recording to add yet", 404);
    return NextResponse.json({ ok: true, run: await startApplyRun(env, file) });
  }

  const parsed = meta.safeParse({ file, offsetMs: form.get("offsetMs") });
  if (!parsed.success) return bad("The timing of the recording didn't come through. Record it again.");
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return bad("The recording is empty. Record it again.");
  if (audio.size > TAKE_MAX_BYTES) return bad("That recording is too large.");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const mime = sniffAudio(bytes);
  if (!mime) return bad("That isn't a recording we can read.");

  const take: TakeMeta = { recordedAt: new Date().toISOString(), offsetMs: parsed.data.offsetMs, mime, bytes: bytes.byteLength };
  await env.DOCS.put(takeKey(file), bytes, { httpMetadata: { contentType: mime } });
  await env.DOCS.put(takeMetaKey(file), JSON.stringify(take), { httpMetadata: { contentType: "application/json" } });
  return NextResponse.json({ ok: true, run: await startApplyRun(env, file), recordedAt: take.recordedAt });
}

/** Remove the recording and the voiced video: the original narration plays again. */
export async function DELETE(req: Request) {
  await requirePlatformAdmin();
  const file = new URL(req.url).searchParams.get("file");
  if (!isVoiceoverFile(file)) return bad("Unknown video", 404);
  await getEnv().DOCS.delete([takeKey(file), takeMetaKey(file), appliedKey(file), voicedVideoKey(file)]);
  return NextResponse.json({ ok: true });
}
