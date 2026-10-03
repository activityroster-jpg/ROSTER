import { describe, expect, it } from "vitest";
import { lvCookieValue, lvDeviceValue, lvPendingValue, verifyLvCookies, verifyLvDevice, verifyLvPending } from "@/lib/auth/login-verify";

const secret = "test-secret-that-is-long-enough-123";

describe("login verified cookie", () => {
  it("accepts a 'stay signed in' proof on its own", async () => {
    const v = await lvCookieValue(secret, "sess1", "p");
    expect(v.startsWith("p:")).toBe(true);
    expect(await verifyLvCookies(secret, "sess1", v, undefined)).toBe(true);
  });
  it("'just this once' also needs the browser-session twin", async () => {
    const v = await lvCookieValue(secret, "sess1", "s");
    expect(await verifyLvCookies(secret, "sess1", v, undefined)).toBe(false);
    expect(await verifyLvCookies(secret, "sess1", v, v.slice(2))).toBe(true);
    expect(await verifyLvCookies(secret, "sess1", v, "nope")).toBe(false);
  });
  it("is bound to the session id and the secret, and can't change mode", async () => {
    const v = await lvCookieValue(secret, "sess1", "p");
    expect(await verifyLvCookies(secret, "sess2", v, undefined)).toBe(false);
    expect(await verifyLvCookies("another-secret-also-long-enough", "sess1", v, undefined)).toBe(false);
    expect(await verifyLvCookies(secret, "sess1", "s:" + v.slice(2), v.slice(2))).toBe(false);
    expect(await verifyLvCookies(secret, "sess1", undefined, undefined)).toBe(false);
    expect(await verifyLvCookies(secret, "sess1", "garbage", undefined)).toBe(false);
  });
  it("pending marker verifies only for its session", async () => {
    const p = await lvPendingValue(secret, "sess1");
    expect(await verifyLvPending(secret, "sess1", p)).toBe(true);
    expect(await verifyLvPending(secret, "sess2", p)).toBe(false);
    expect(await verifyLvPending(secret, "sess1", undefined)).toBe(false);
  });

  it("device marker is bound to the user", async () => {
    const d = await lvDeviceValue(secret, "user1");
    expect(await verifyLvDevice(secret, "user1", d)).toBe(true);
    expect(await verifyLvDevice(secret, "user2", d)).toBe(false);
    expect(await verifyLvDevice(secret, "user1", undefined)).toBe(false);
  });
});
