import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GUIDE_SCREENS, SCREENS, TOUR } from "@/lib/screens";
import { SECTIONS } from "@/lib/learn/sections";

const ids = new Set(SECTIONS.map((s) => s.id));

describe("platform screenshots", () => {
  it("every screenshot file exists and has the size the catalogue says", () => {
    for (const s of Object.values(SCREENS)) {
      const file = join(process.cwd(), "public", s.src);
      expect(existsSync(file), s.src).toBe(true);
      // WebP (VP8X/VP8/VP8L): read the canvas size from the header.
      const bytes = new Uint8Array(readFileSync(file));
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
      const u24 = (at: number) => v.getUint16(at, true) | (v.getUint8(at + 2) << 16);
      expect(text(0, 4)).toBe("RIFF");
      const chunk = text(12, 16);
      let w = 0, h = 0;
      if (chunk === "VP8X") { w = 1 + u24(24); h = 1 + u24(27); }
      else if (chunk === "VP8 ") { w = v.getUint16(26, true) & 0x3fff; h = v.getUint16(28, true) & 0x3fff; }
      else { const bits = v.getUint32(21, true); w = (bits & 0x3fff) + 1; h = ((bits >> 14) & 0x3fff) + 1; }
      expect([w, h], s.src).toEqual([s.width, s.height]);
    }
  });

  it("links every screenshot and guide to a real Learning Centre section", () => {
    for (const s of Object.values(SCREENS)) expect(ids.has(s.topic), s.topic).toBe(true);
    for (const key of Object.keys(GUIDE_SCREENS)) expect(ids.has(key), key).toBe(true);
  });

  it("the demo tour uses each screen once", () => {
    const all = TOUR.flatMap((g) => g.ids);
    expect(new Set(all).size).toBe(all.length);
  });
});
