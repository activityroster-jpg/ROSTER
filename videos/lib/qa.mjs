import { spawnSync } from "node:child_process";
import { FFMPEG } from "./ffmpeg.mjs";

/**
 * The edit and the checks that keep mistakes out of the videos.
 *
 * The edit: a recording can hold stretches where nothing happens and nothing
 * is said (a page slow to load, a step that missed). Where the screen is
 * still, the middle of the stretch is cut: the picture doesn't change, so the
 * cut can't be seen. Where the screen is moving with nothing said for a long
 * time (typing, a spinner), that part plays faster. Narration is never cut.
 *
 * The checks, on every finished video: every step found what it was looking
 * for; each voice clip is about as long as its words (a clip cut short is
 * caught); no long stretch with nothing said; no lines overlapping; the
 * narration ends before the end card; no long frozen picture; and the file
 * plays, picture and sound, right to the end.
 */

/** A still, silent stretch longer than STILL seconds is dead air, and is cut down to KEEP. */
const STILL = 1.5, KEEP = 0.8;
/** The breath kept after the last line, before the end card. */
const TAIL = 1.4;
/** A silent stretch with movement on screen is sped up (at most 4×) towards QUIET seconds. */
const QUIET = 2.2, MAX_SPEED = 4;

/** Edits are [from, to, kept]: the stretch from..to plays at `kept` of its length (0: cut). */
export const shiftBy = (edits) => (t) => t - edits.reduce((d, [a, b, k = 0]) => d + Math.max(0, Math.min(t, b) - a) * (1 - k), 0);

/** The stretches with nothing said, in a..b. */
function unsaid(a, b, said) {
  let parts = [[a, b]];
  for (const [s, e] of said) parts = parts.flatMap(([x, y]) => (e <= x || s >= y ? [[x, y]] : [[x, s], [e, y]].filter(([p, q]) => q > p)));
  return parts;
}

/**
 * The dead-air edit for one recording. frames: [{ t }] (a frame arrives only
 * when the screen changes); end: when the recording stopped; said:
 * [[from, to]] for each line of narration; all in seconds from the first
 * frame. Returns `at`, which moves a time on the recording to its time in the
 * edited video, and how many stretches were cut and sped up.
 */
export function editDeadAir(frames, end, said) {
  // 1. Cut still, silent stretches.
  const cuts = [];
  for (let k = 0; k < frames.length; k++) {
    const from = frames[k].t, to = k + 1 < frames.length ? frames[k + 1].t : end;
    if (to - from <= STILL) continue;
    for (const [a, b] of unsaid(from, to, said)) {
      if (b >= end) { if (b - a > TAIL + 0.2) cuts.push([a + TAIL, b, 0]); }
      else if (b - a > STILL) cuts.push([a + KEEP / 2, b - KEEP / 2, 0]);
    }
  }
  const cut = shiftBy(cuts);
  // 2. Speed up what's left of any long silent stretch between two lines, or after the last (the screen is moving there).
  const lines = said.map(([s, e]) => [cut(s), cut(e)]);
  const fast = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i][1], b = lines[i + 1][0];
    if (b - a > QUIET + 0.6) fast.push([a + 0.4, b - 0.4, Math.max(1 / MAX_SPEED, (QUIET - 0.8) / (b - a - 0.8))]);
  }
  const last = lines.at(-1)?.[1] ?? 0, fin = cut(end);
  if (fin - last > TAIL + 1) fast.push([last + 0.4, fin - 0.4, Math.max(1 / MAX_SPEED, (TAIL - 0.8) / (fin - last - 0.8))]);
  const speed = shiftBy(fast);
  return { at: (t) => speed(cut(t)), cuts: cuts.length, sped: fast.length };
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const run = (args) => spawnSync(FFMPEG, ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 256 << 20 });

/** How far a stream of the file actually decodes, in seconds, and any decoding errors. */
function decoded(file, stream) {
  const r = run(["-v", "error", "-i", file, "-map", `0:${stream}:0`, "-f", "null", "-progress", "pipe:1", "-nostats", "-"]);
  const times = [...(r.stdout ?? "").matchAll(/out_time_us=(\d+)/g)];
  return { seconds: times.length ? Number(times.at(-1)[1]) / 1e6 : 0, errors: (r.stderr ?? "").trim() };
}

/** [from, length] of each detected stretch, from silencedetect or freezedetect output. */
function stretches(log, kind) {
  const starts = [...log.matchAll(new RegExp(`${kind}_start: ([\\d.]+)`, "g"))].map((m) => Number(m[1]));
  const lens = [...log.matchAll(new RegExp(`${kind}_duration: ([\\d.]+)`, "g"))].map((m) => Number(m[1]));
  return starts.map((s, i) => [s, lens[i] ?? Infinity]);
}

/**
 * Check a finished video. Returns problems (the video isn't right) and notes
 * (worth knowing, not wrong). Times are in the finished video's seconds.
 */
export async function checkVideo({ final, main, introLen, outroStart, total, starts, lines, voice, warnings, music }) {
  const problems = warnings.map((w) => `a step missed (${w})`);
  const notes = [];

  // 1. Each voice clip about as long as its words, against this video's usual pace (a clip that stops
  //    early reads fast; one with a long gap or trailing noise reads slow).
  if (voice.some((l) => l.file)) {
    const pace = voice.map((l, i) => words(lines[i]) / l.seconds).filter((_, i) => words(lines[i]) >= 6).sort((a, b) => a - b);
    const usual = pace[Math.floor(pace.length / 2)] ?? 3;
    voice.forEach((l, i) => {
      const n = words(lines[i]), wps = n / l.seconds, expect = n / usual;
      if (n >= 6 && wps > usual * 1.4) problems.push(`line ${i + 1}'s voice clip looks cut short (${l.seconds.toFixed(1)}s, about ${expect.toFixed(0)}s expected)`);
      else if (l.seconds > expect * 1.6 + 1.5) problems.push(`line ${i + 1}'s voice clip has a long gap in it (${l.seconds.toFixed(1)}s, about ${expect.toFixed(0)}s expected)`);
    });
  }

  // 2. The timeline: nothing said for a while, lines overlapping, narration running into the end card.
  const said = voice.map((l, i) => [starts[i], starts[i] + l.seconds]);
  const gaps = [[introLen, said[0][0]], ...said.slice(1).map((s, i) => [said[i][1], s[0]]), [said.at(-1)[1], outroStart]];
  gaps.forEach(([a, b], i) => {
    const last = i === gaps.length - 1;
    if (b - a < -0.05) problems.push(last ? `the narration runs ${(a - b).toFixed(1)}s into the end card` : `lines ${i} and ${i + 1} overlap at ${mmss(b)}`);
    else if (b - a > 4) problems.push(`${(b - a).toFixed(1)}s with nothing said at ${mmss(a)}`);
    else if (b - a > 3) notes.push(`a ${(b - a).toFixed(1)}s pause at ${mmss(a)}`);
  });

  // 3. The file plays to the end: picture and sound both decode all the way, without errors.
  for (const [stream, label] of [["v", "picture"], ["a", "sound"]]) {
    const d = decoded(final, stream);
    if (d.errors) problems.push(`the ${label} has decoding errors: ${d.errors.split("\n")[0].slice(0, 160)}`);
    if (d.seconds < total - 0.3) problems.push(`the ${label} stops at ${mmss(d.seconds)} of ${mmss(total)}`);
  }

  // 4. No silence in the sound itself between the title card and the end card (the music under the explainer would hide it; step 2 covers that one).
  if (!music && voice.some((l) => l.file)) {
    const log = run(["-i", final, "-map", "0:a:0", "-af", "silencedetect=noise=-45dB:d=3.5", "-f", "null", "-"]).stderr ?? "";
    for (const [s, len] of stretches(log, "silence")) {
      const from = Math.max(s, introLen + 0.3), to = Math.min(s + len, outroStart - 0.3);
      if (to - from >= 3.5) problems.push(`${(to - from).toFixed(1)}s of silence at ${mmss(from)}`);
    }
  }

  // 5. No long frozen picture in the walk-through.
  const log = run(["-i", main, "-map", "0:v:0", "-vf", "freezedetect=n=-60dB:d=12", "-f", "null", "-"]).stderr ?? "";
  for (const [s, len] of stretches(log, "freeze")) {
    const length = Number.isFinite(len) ? len : total - introLen - s;
    if (length >= 20) problems.push(`the picture is frozen for ${length.toFixed(0)}s at ${mmss(introLen + s)}`);
    else notes.push(`the screen is still for ${length.toFixed(0)}s at ${mmss(introLen + s)}`);
  }

  return { problems, notes };
}
