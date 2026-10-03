import { describe, expect, it } from "vitest";
import { clampIdleMinutes, pinCookieValue, pinIdleSecondsFrom, verifyPinCookie, hmacSign } from "@/lib/auth/pin";

describe("PIN cookie idle timeout", () => {
  it("carries the centre's idle minutes and verifies", async () => {
    const v = await pinCookieValue("secret", "sess-1", 15);
    expect(v.startsWith("15.")).toBe(true);
    expect(await verifyPinCookie("secret", "sess-1", v)).toBe(true);
    expect(await verifyPinCookie("secret", "sess-2", v)).toBe(false);
    expect(await verifyPinCookie("other", "sess-1", v)).toBe(false);
    expect(pinIdleSecondsFrom(v)).toBe(15 * 60);
  });
  it("refuses a tampered idle prefix", async () => {
    const v = await pinCookieValue("secret", "sess-1", 15);
    const tampered = `240.${v.slice(v.indexOf(".") + 1)}`;
    expect(await verifyPinCookie("secret", "sess-1", tampered)).toBe(false);
    expect(await verifyPinCookie("secret", "sess-1", `9999.${v.slice(v.indexOf(".") + 1)}`)).toBe(false);
  });
  it("still accepts cookies issued before the change (30 minutes)", async () => {
    const legacy = await hmacSign("secret", "pin:sess-1");
    expect(await verifyPinCookie("secret", "sess-1", legacy)).toBe(true);
    expect(pinIdleSecondsFrom(legacy)).toBe(30 * 60);
  });
  it("clamps the setting to 5–240 minutes", () => {
    expect(clampIdleMinutes(1)).toBe(5);
    expect(clampIdleMinutes(1000)).toBe(240);
    expect(clampIdleMinutes("abc")).toBe(30);
    expect(clampIdleMinutes(45)).toBe(45);
  });
});
