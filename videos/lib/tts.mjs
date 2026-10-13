import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ffmpeg, durationOf } from "./ffmpeg.mjs";

/**
 * The narration voice. Chosen by which key is set (GitHub secrets on the
 * Make videos workflow):
 *   ELEVENLABS_API_KEY            ElevenLabs (recommended); ELEVENLABS_VOICE_ID picks the voice
 *   GOOGLE_TTS_API_KEY            Google Cloud Text-to-Speech, en-GB Neural2 voice
 *   AZURE_SPEECH_KEY (+ _REGION)  Microsoft Azure neural voice, en-GB
 *   none                          a preview voice made on the runner (Piper, en_GB), for checking timing only
 * Only the script text is sent. Each line is cached by provider, voice and
 * text, so a re-run pays only for lines that changed.
 */
const CACHE = process.env.VIDEO_CACHE || join(process.cwd(), "videos", ".cache", "voice");

export function voiceProvider() {
  if (process.env.ELEVENLABS_API_KEY) return { id: "elevenlabs", voice: process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb" /* George: warm British narrator */, label: "ElevenLabs" };
  if (process.env.GOOGLE_TTS_API_KEY) return { id: "google", voice: process.env.GOOGLE_TTS_VOICE || "en-GB-Neural2-B", label: "Google" };
  if (process.env.AZURE_SPEECH_KEY) return { id: "azure", voice: process.env.AZURE_SPEECH_VOICE || "en-GB-RyanNeural", label: "Microsoft" };
  if (process.env.PIPER_MODEL) return { id: "piper", voice: process.env.PIPER_MODEL, label: "preview voice (Piper)" };
  return { id: "silent", voice: "none", label: "no voice (timing only)" };
}

async function fetchAudio(p, text, ctx) {
  if (p.id === "elevenlabs") {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${p.voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        // The lines either side keep the delivery flowing like one read-through.
        previous_text: ctx.previous || undefined,
        next_text: ctx.next || undefined,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
  }
  if (p.id === "google") {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(process.env.GOOGLE_TTS_API_KEY)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: "en-GB", name: p.voice }, audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 } }),
    });
    if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { bytes: Buffer.from((await res.json()).audioContent, "base64"), ext: "mp3" };
  }
  if (p.id === "azure") {
    const region = process.env.AZURE_SPEECH_REGION || "uksouth";
    const esc = text.replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY, "content-type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3", "user-agent": "activityroster-videos" },
      body: `<speak version="1.0" xml:lang="en-GB"><voice name="${p.voice}">${esc}</voice></speak>`,
    });
    if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
  }
  if (p.id === "piper") {
    const out = join(CACHE, `piper-${Date.now()}.wav`);
    const r = spawnSync(process.env.PIPER_BIN || "piper", ["--model", p.voice, "--output_file", out], { input: text, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`piper failed: ${r.stderr?.slice(-300)}`);
    return { file: out };
  }
  return null;
}

/**
 * Make (or reuse) the audio for every line. Returns, per line, a 48 kHz mono
 * WAV and its length in seconds. With no voice, the length is estimated from
 * the words so the timing can still be checked.
 */
export async function voiceLines(lines) {
  const p = voiceProvider();
  mkdirSync(CACHE, { recursive: true });
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (p.id === "silent") {
      const words = text.split(/\s+/).filter(Boolean).length;
      out.push({ file: null, seconds: Math.max(1.2, words / 2.6 + 0.3) });
      continue;
    }
    const key = createHash("sha256").update(`${p.id}|${p.voice}|${process.env.ELEVENLABS_MODEL ?? ""}|${text}`).digest("hex").slice(0, 24);
    const wav = join(CACHE, `${key}.wav`);
    if (!existsSync(wav)) {
      let got;
      try { got = await fetchAudio(p, text, { previous: lines[i - 1], next: lines[i + 1] }); }
      catch (e) {
        // The preview voice is only for checking timing: if it can't run, carry on silently rather than fail the video.
        if (p.id !== "piper") throw e;
        console.log(`  preview voice failed (${String(e).slice(0, 120)}); timing only`);
        const words = text.split(/\s+/).filter(Boolean).length;
        out.push({ file: null, seconds: Math.max(1.2, words / 2.6 + 0.3) });
        continue;
      }
      let src = got.file;
      if (!src) { src = join(CACHE, `${key}.${got.ext}`); writeFileSync(src, got.bytes); }
      // Trim the silence the engines leave at either end, then normalise to one format.
      await ffmpeg(["-i", src, "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", "-ar", "48000", "-ac", "1", wav]);
    }
    out.push({ file: wav, seconds: await durationOf(wav) });
  }
  return { provider: p, lines: out };
}
