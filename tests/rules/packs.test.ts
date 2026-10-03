import { describe, expect, it } from "vitest";
import { BUILTIN_PACKS, packKeyFor } from "@/lib/rules/working-time/packs";
import { parsePack } from "@/lib/rules/working-time/schema";

describe("built-in rule packs", () => {
  it("every built-in pack passes the pack schema", () => {
    for (const [key, pack] of Object.entries(BUILTIN_PACKS)) {
      const r = parsePack(JSON.stringify(pack));
      expect(r.ok, `${key}: ${r.ok ? "" : r.error}`).toBe(true);
      if (r.ok) expect(r.pack.key).toBe(key);
    }
  });
  it("a pack cannot be marked verified while a band still lists unverified figures", () => {
    const ni = structuredClone(BUILTIN_PACKS.ni!);
    ni.verified = true;
    expect(ni.bands.some((b) => b.unverified.length > 0)).toBe(true);
    const r = parsePack(JSON.stringify(ni));
    expect(r.ok).toBe(false);
  });
  it("rejects malformed figures with a readable path", () => {
    const ie = structuredClone(BUILTIN_PACKS.ie!);
    ie.bands[0]!.earliestStart = "7am";
    const r = parsePack(JSON.stringify(ie));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/bands\.0\.earliestStart/);
    expect(parsePack("{not json").ok).toBe(false);
  });
  it("maps jurisdictions to packs, and unknown ones to none", () => {
    expect(packKeyFor("england")).toBe("gb");
    expect(packKeyFor("scotland")).toBe("gb");
    expect(packKeyFor("northern_ireland")).toBe("ni");
    expect(packKeyFor("ireland")).toBe("ie");
    expect(packKeyFor("other")).toBeNull();
    expect(packKeyFor(null)).toBeNull();
  });
});
