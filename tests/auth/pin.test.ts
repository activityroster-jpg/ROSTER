import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, pinCookieValue, verifyPinCookie, PIN_REGEX } from "@/lib/auth/pin";

describe("login PIN crypto", () => {
  it("hashes and verifies a correct PIN, rejects wrong ones", async () => {
    const stored = await hashPin("1234");
    expect(stored.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPin("1234", stored)).toBe(true);
    expect(await verifyPin("4321", stored)).toBe(false);
    expect(await verifyPin("0000", stored)).toBe(false);
  });

  it("produces different hashes for the same PIN (random salt)", async () => {
    expect(await hashPin("1234")).not.toBe(await hashPin("1234"));
  });

  it("signs a session-bound cookie that only verifies for that session", async () => {
    const secret = "test-secret";
    const value = await pinCookieValue(secret, "session-A");
    expect(await verifyPinCookie(secret, "session-A", value)).toBe(true);
    expect(await verifyPinCookie(secret, "session-B", value)).toBe(false);
    expect(await verifyPinCookie("other-secret", "session-A", value)).toBe(false);
    expect(await verifyPinCookie(secret, "session-A", undefined)).toBe(false);
  });

  it("PIN_REGEX only accepts exactly 4 digits", () => {
    expect(PIN_REGEX.test("1234")).toBe(true);
    expect(PIN_REGEX.test("123")).toBe(false);
    expect(PIN_REGEX.test("12345")).toBe(false);
    expect(PIN_REGEX.test("12a4")).toBe(false);
  });
});
