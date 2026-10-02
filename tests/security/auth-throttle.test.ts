import { describe, it, expect } from "vitest";
import { authThrottleRule, emailFromBody } from "@/lib/security/auth-throttle";

describe("auth throttle rules", () => {
  it("covers the credential, magic-link, reset and 2FA endpoints (POST only)", () => {
    expect(authThrottleRule("POST", "/api/auth/sign-in/email")?.key).toBe("signin");
    expect(authThrottleRule("POST", "/api/auth/sign-in/magic-link")?.key).toBe("magic");
    expect(authThrottleRule("POST", "/api/auth/forget-password")?.key).toBe("forgot");
    expect(authThrottleRule("POST", "/api/auth/request-password-reset")?.key).toBe("forgot");
    expect(authThrottleRule("POST", "/api/auth/two-factor/verify-totp")?.key).toBe("2fa");
    expect(authThrottleRule("POST", "/api/auth/verify-password")?.key).toBe("verifypw");
    expect(authThrottleRule("POST", "/api/auth/sign-in/email/")?.key).toBe("signin"); // trailing slash
  });

  it("leaves session reads, sign-out and unknown paths alone", () => {
    expect(authThrottleRule("GET", "/api/auth/get-session")).toBeNull();
    expect(authThrottleRule("GET", "/api/auth/sign-in/email")).toBeNull();
    expect(authThrottleRule("POST", "/api/auth/sign-out")).toBeNull();
    expect(authThrottleRule("POST", "/api/auth/sign-in/emailx")).toBeNull();
  });

  it("extracts a normalised email from a body, or nothing", () => {
    expect(emailFromBody({ email: "  Owner@Club.TEST " })).toBe("owner@club.test");
    expect(emailFromBody({ email: 42 })).toBeNull();
    expect(emailFromBody({ email: "nope" })).toBeNull();
    expect(emailFromBody(null)).toBeNull();
  });
});
