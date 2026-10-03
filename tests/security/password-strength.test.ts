import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/lib/security/password-strength";

describe("password strength meter", () => {
  it("scores by the rule and beyond", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("abcdefgh").meetsRule).toBe(false);   // no number
    expect(passwordStrength("12345678").meetsRule).toBe(false);   // no letter
    expect(passwordStrength("sailing12").score).toBe(1);          // meets rule, weak
    expect(passwordStrength("Sailing12").score).toBe(2);          // mixed case
    expect(passwordStrength("sailing-boats-2026").score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("Blue-Boats-Go-Fast-2026").score).toBe(4);
  });
  it("flags common passwords", () => {
    expect(passwordStrength("Password1").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("12345678a").score).toBeLessThanOrEqual(1);
  });
});
