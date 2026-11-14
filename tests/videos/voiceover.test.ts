import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { karaokeAt, narrationSpan, parseTimestamp, parseVtt } from "@/lib/learn/karaoke";
import { isVoiceoverFile, sniffAudio, voiceStatus, VOICEOVER_VIDEOS } from "@/lib/videos/voiceover";
import { noncePolicy } from "@/lib/security/csp";

const VTT = `WEBVTT

1
00:00:03.000 --> 00:00:07.000
Open Courses,
then press Add.

2
00:00:08.000 --> 00:00:10.000
Done.
`;

/** Recording a voice over the how-to videos: karaoke prompts from the captions, and where each video stands. */
describe("karaoke prompts", () => {
  it("reads WebVTT and SRT timestamps and cues, joining wrapped lines", () => {
    expect(parseTimestamp("00:01:02.345")).toBeCloseTo(62.345);
    expect(parseTimestamp("01:02,500")).toBeCloseTo(62.5);
    const cues = parseVtt(VTT);
    expect(cues).toEqual([{ start: 3, end: 7, text: "Open Courses, then press Add." }, { start: 8, end: 10, text: "Done." }]);
    expect(narrationSpan(cues)).toEqual({ from: 3, to: 10 });
  });

  it("lights words up in order through the line, and counts down between lines", () => {
    const cues = parseVtt(VTT);
    const before = karaokeAt(cues, 1);
    expect(before.current).toBeNull();
    expect(before.next?.text).toBe("Open Courses, then press Add.");
    expect(before.until).toBeCloseTo(2);
    const mid = karaokeAt(cues, 5);
    const p = mid.current!.words.map((w) => w.progress);
    expect(p[0]).toBe(1);
    expect(p[p.length - 1]).toBe(0);
    expect([...p].sort((a, b) => b - a)).toEqual(p);
    expect(karaokeAt(cues, 6.999).current!.words.every((w) => w.progress > 0.9)).toBe(true);
    expect(karaokeAt(cues, 7.5).next?.text).toBe("Done.");
    expect(karaokeAt(cues, 11)).toEqual({ current: null, next: null, until: null, index: 2 });
  });
});

describe("voice-over storage and status", () => {
  it("knows the thirteen videos and nothing else", () => {
    expect(VOICEOVER_VIDEOS).toHaveLength(13);
    expect(isVoiceoverFile("01-setup-wizard")).toBe(true);
    expect(isVoiceoverFile("../../secrets")).toBe(false);
  });

  it("reads the recording's format from its bytes", () => {
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/webm");
    expect(sniffAudio(new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]))).toBe("audio/mp4");
    expect(sniffAudio(new TextEncoder().encode("<html><body>nope</body>"))).toBeNull();
  });

  it("says when the voice is on the video, waiting, or out of date after a remake", () => {
    const take = { recordedAt: "2026-11-14T10:00:00Z", offsetMs: 120, mime: "audio/webm", bytes: 1 };
    expect(voiceStatus(null, null, null)).toBe("none");
    expect(voiceStatus(take, null, "2026-11-01T00:00:00Z")).toBe("recorded");
    expect(voiceStatus(take, { recordedAt: take.recordedAt, appliedAt: "2026-11-14T10:05:00Z" }, "2026-11-01T00:00:00Z")).toBe("voiced");
    expect(voiceStatus(take, { recordedAt: take.recordedAt, appliedAt: "2026-11-14T10:05:00Z" }, "2026-11-20T00:00:00Z")).toBe("stale");
  });
});

describe("browser permissions for the recorder", () => {
  it("allows the microphone on the recorder page only, and blob: media in the signed-in policy", () => {
    const cfg = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
    expect(cfg).toMatch(/microphone=\(\)/);
    expect(cfg).toMatch(/source: "\/admin\/videos", headers: \[\{ key: "Permissions-Policy", value: "[^"]*microphone=\(self\)/);
    expect(noncePolicy("n")).toContain("media-src 'self' blob:");
  });
});
