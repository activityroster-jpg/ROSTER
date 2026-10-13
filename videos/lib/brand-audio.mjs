import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The series' own sound: a short logo sting under the intro animation and a
 * light music bed under the title card and the outro (never under the
 * narration). Made once with ElevenLabs Sound Effects and Music, cached, and
 * reused by every video, so the series sounds the same throughout. Without an
 * ElevenLabs key, or if a request fails, the video is simply made without them.
 */
const CACHE = join(process.cwd(), "videos", ".cache", "brand");

export const STING_PROMPT = "Short clean modern logo sting for a friendly software brand: a soft airy whoosh rising into a bright, gentle two-note chime with a light shimmer tail. Warm, optimistic, polished. No voice.";
export const MUSIC_PROMPT = "Light, upbeat, optimistic background music for a friendly software tutorial about sailing centres: gentle plucked acoustic guitar, soft synth pads, light hand percussion, relaxed steady tempo around 100 bpm, bright and breezy, no vocals, ends cleanly.";

const file = (kind, prompt) => join(CACHE, `${kind}-${createHash("sha256").update(prompt).digest("hex").slice(0, 16)}.mp3`);

async function post(path, body) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function make(kind, prompt, request) {
  const out = file(kind, prompt);
  if (existsSync(out)) return out;
  try {
    writeFileSync(out, await request());
    return out;
  } catch (e) {
    console.log(`  ⚠ ${kind} not made (${String(e).slice(0, 160)}); carrying on without it`);
    return null;
  }
}

export async function brandAudio() {
  if (!process.env.ELEVENLABS_API_KEY || process.env.VIDEO_NO_MUSIC) return { sting: null, music: null };
  mkdirSync(CACHE, { recursive: true });
  const sting = await make("sting", STING_PROMPT, () => post("/v1/sound-generation", { text: STING_PROMPT, duration_seconds: 3.2, prompt_influence: 0.5 }));
  const music = await make("music", MUSIC_PROMPT, async () => {
    try { return await post("/v1/music", { prompt: MUSIC_PROMPT, music_length_ms: 20000, force_instrumental: true }); }
    catch { return await post("/v1/music", { prompt: MUSIC_PROMPT, music_length_ms: 20000 }); }
  });
  return { sting, music };
}
