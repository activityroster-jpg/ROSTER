/**
 * Karaoke prompts for recording a voice-over: the video's captions (WebVTT,
 * made by videos/make.mjs and timed to the original narration) read as what to
 * say and when. Within a cue, words light up in proportion to their length, the
 * same way make.mjs timed the cues inside each spoken line. Pure: no DOM.
 */
export interface Cue { start: number; end: number; text: string }

const TS = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/;

/** Seconds from a WebVTT/SRT timestamp ("00:01:02.345" or "01:02.345"). */
export function parseTimestamp(s: string): number | null {
  const m = TS.exec(s.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** The cues of a WebVTT (or SRT) file, in time order, each as one line of text. */
export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at]!.split("-->");
    const start = parseTimestamp(a ?? ""), end = parseTimestamp((b ?? "").split(/\s+/).filter(Boolean)[0] ?? "");
    const words = lines.slice(at + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (start == null || end == null || end <= start || !words) continue;
    cues.push({ start, end, text: words });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export interface KaraokeWord { word: string; /** 0 = not reached, 1 = said; in between while it is being said. */ progress: number }
export interface KaraokeFrame {
  /** The line to say now, word by word, or null between lines. */
  current: { cue: Cue; words: KaraokeWord[] } | null;
  /** The line after it (or the next one coming up, between lines). */
  next: Cue | null;
  /** Seconds until the next line starts, when nothing is being said. */
  until: number | null;
  /** Lines done so far, for "line 4 of 31". */
  index: number;
}

/** What to show at time `t` (seconds into the video). */
export function karaokeAt(cues: Cue[], t: number): KaraokeFrame {
  const i = cues.findIndex((c) => t < c.end);
  if (i < 0) return { current: null, next: null, until: null, index: cues.length };
  const c = cues[i]!;
  if (t < c.start) return { current: null, next: c, until: c.start - t, index: i };
  const words = c.text.split(" ");
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const span = c.end - c.start;
  let from = 0;
  const out = words.map((word) => {
    const share = ((word.length + 1) / total) * span;
    const s = c.start + from;
    from += share;
    return { word, progress: Math.max(0, Math.min(1, (t - s) / share)) };
  });
  return { current: { cue: c, words: out }, next: cues[i + 1] ?? null, until: null, index: i };
}

/** Where the narration starts and ends, so the original title-card and outro audio can be kept. */
export function narrationSpan(cues: Cue[]): { from: number; to: number } | null {
  if (!cues.length) return null;
  return { from: cues[0]!.start, to: cues[cues.length - 1]!.end };
}
