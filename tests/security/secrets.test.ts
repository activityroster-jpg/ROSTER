import { describe, it, expect } from "vitest";
import { requireSecret } from "@/lib/security/secrets";
import type { CloudflareEnv } from "@/lib/cf/bindings";

const env = (over: Partial<CloudflareEnv>): CloudflareEnv => ({ APP_APEX_DOMAIN: "x.test", APP_ENV: "production", ...over }) as CloudflareEnv;

describe("requireSecret", () => {
  it("throws in production when the secret is missing or too short", () => {
    expect(() => requireSecret("BETTER_AUTH_SECRET", env({}))).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => requireSecret("BETTER_AUTH_SECRET", env({ BETTER_AUTH_SECRET: "short" }))).toThrow();
  });
  it("returns the configured secret", () => {
    expect(requireSecret("STRIPE_WEBHOOK_SECRET", env({ STRIPE_WEBHOOK_SECRET: "a-perfectly-long-secret-value" }))).toBe("a-perfectly-long-secret-value");
  });
  it("falls back to a dev value outside production", () => {
    expect(requireSecret("BETTER_AUTH_SECRET", env({ APP_ENV: "development" }))).toBe("dev-insecure-secret-change-me");
  });
});
