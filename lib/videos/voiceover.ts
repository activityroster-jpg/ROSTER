import type { CloudflareEnv } from "@/lib/cf/bindings";
import { EXPLAINER, VIDEOS, type SiteVideo } from "@/lib/learn/videos";

/**
 * Voice-overs: Conor records his own voice over a how-to video in the Dev
 * Center (Growth → Video voice-overs), reading karaoke prompts made from the
 * captions. The take is kept in storage; the "Apply voiceovers" GitHub Action
 * (videos/apply-voiceovers.sh) puts it on the video with ffmpeg, keeping the
 * original logo sting and outro music, and saves the result next to the
 * original. /api/videos serves the voiced version once it exists. The website
 * itself can't run ffmpeg, which is why the merge happens in GitHub.
 *
 * Storage (DOCS bucket, platform area, nothing per-centre):
 *   platform/voiceovers/<file>/take        the recording, as recorded
 *   platform/voiceovers/<file>/take.json   { recordedAt, offsetMs, mime, bytes }
 *   platform/voiceovers/<file>/applied.json { recordedAt, appliedAt } (written by the Action)
 *   public/videos/voiced/<file>.mp4        the video with the voice on it
 */

export const VOICEOVER_VIDEOS: SiteVideo[] = [EXPLAINER, ...VIDEOS];
export const isVoiceoverFile = (f: unknown): f is string => typeof f === "string" && VOICEOVER_VIDEOS.some((v) => v.file === f);

export const takeKey = (file: string) => `platform/voiceovers/${file}/take`;
export const takeMetaKey = (file: string) => `platform/voiceovers/${file}/take.json`;
export const appliedKey = (file: string) => `platform/voiceovers/${file}/applied.json`;
export const voicedVideoKey = (file: string) => `public/videos/voiced/${file}.mp4`;
export const originalVideoKey = (file: string) => `public/videos/${file}.mp4`;

/** A recording longer than any video needs (opus at 128 kbit/s is about 1 MB a minute). */
export const TAKE_MAX_BYTES = 40 * 1024 * 1024;

export interface TakeMeta {
  recordedAt: string;
  /** How long the microphone was recording before the video started (ms); the Action trims this off. */
  offsetMs: number;
  mime: string;
  bytes: number;
}
export interface AppliedMeta { recordedAt: string; appliedAt: string }

/** The audio container, read from the file's first bytes (never the browser's claim). */
export function sniffAudio(b: Uint8Array): string | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x);
  if (b.length < 12) return null;
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "audio/webm";
  if (at(0, 0x4f, 0x67, 0x67, 0x53)) return "audio/ogg";
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return "audio/mp4";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x41, 0x56, 0x45)) return "audio/wav";
  return null;
}

export type VoiceStatus = "none" | "recorded" | "voiced" | "stale";
export interface VoiceoverRow {
  file: string;
  n: number;
  title: string;
  take: TakeMeta | null;
  applied: AppliedMeta | null;
  /** When the original video was last published (a Make videos run + deploy). */
  originalAt: string | null;
  status: VoiceStatus;
}

/**
 * Pure: where a video stands. "stale" when the video was remade after the
 * recording, so the voice no longer matches the screen and wants recording again.
 */
export function voiceStatus(take: TakeMeta | null, applied: AppliedMeta | null, originalAt: string | null): VoiceStatus {
  if (!take) return "none";
  if (originalAt && Date.parse(originalAt) > Date.parse(take.recordedAt)) return "stale";
  return applied?.recordedAt === take.recordedAt ? "voiced" : "recorded";
}

async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  try { const o = await bucket.get(key); return o ? ((await o.json()) as T) : null; } catch { return null; }
}

export async function voiceoverRows(bucket: R2Bucket): Promise<VoiceoverRow[]> {
  return Promise.all(VOICEOVER_VIDEOS.map(async (v) => {
    const [take, applied, original] = await Promise.all([readJson<TakeMeta>(bucket, takeMetaKey(v.file)), readJson<AppliedMeta>(bucket, appliedKey(v.file)), bucket.head(originalVideoKey(v.file)).catch(() => null)]);
    const originalAt = original?.uploaded ? new Date(original.uploaded).toISOString() : null;
    return { file: v.file, n: v.n, title: v.title, take, applied, originalAt, status: voiceStatus(take, applied, originalAt) };
  }));
}

/** The repository the Action lives in. */
const REPO = "activityroster-jpg/ROSTER";

/**
 * Start the "Apply voiceovers" Action for one video, so the voice is on it a
 * few minutes later. Needs GITHUB_ACTIONS_TOKEN (a fine-grained token for this
 * repository with Actions: read and write). Without it the nightly run picks
 * the recording up instead.
 */
export async function startApplyRun(env: CloudflareEnv, file: string): Promise<"started" | "no-token" | "failed"> {
  const token = env.GITHUB_ACTIONS_TOKEN;
  if (!token) return "no-token";
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "ActivityRoster" };
  try {
    const repo = await fetch(`https://api.github.com/repos/${REPO}`, { headers });
    const ref = repo.ok ? ((await repo.json()) as { default_branch?: string }).default_branch : null;
    if (!ref) return "failed";
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/voiceovers.yml/dispatches`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref, inputs: { only: file, target: env.APP_ENV === "staging" ? "staging" : "production" } }),
    });
    return res.status === 204 ? "started" : "failed";
  } catch {
    return "failed";
  }
}
