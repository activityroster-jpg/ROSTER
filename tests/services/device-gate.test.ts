import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { createRepositories, type Repositories } from "@/lib/db/repositories";

/**
 * A new device is only challenged somewhere NEW: the account must have been used
 * in that country before (office users: that city too). lib/auth/device-gate.ts
 * trusts a new device silently when hasTrustedPlace says yes.
 */
describe("trusted places", () => {
  let repos: Repositories;
  let userId: string;

  beforeEach(async () => {
    const { db } = createTestDb();
    repos = createRepositories(db);
    userId = (await repos.control.createUser({ name: "Alex", email: "alex@example.com" })).id;
  });

  it("knows a country once any device was confirmed there", async () => {
    expect(await repos.control.hasTrustedPlace(userId, "GB", "Poole")).toBe(false);
    await repos.control.trustDevice({ userId, deviceId: "dev-laptop", ip: "1.1.1.1", country: "GB", city: "Poole", userAgent: "Mac" });
    expect(await repos.control.hasTrustedPlace(userId, "GB", "Weymouth")).toBe(true);
    expect(await repos.control.hasTrustedPlace(userId, "IE", "Dublin")).toBe(false);
    expect(await repos.control.isTrustedDevice(userId, "dev-phone", "2.2.2.2", "GB", "Weymouth")).toBe(false);
  });

  it("strict (office) users need the city to match too, when both are known", async () => {
    await repos.control.trustDevice({ userId, deviceId: "dev-laptop", ip: "1.1.1.1", country: "GB", city: "Poole", userAgent: "Mac" });
    expect(await repos.control.hasTrustedPlace(userId, "GB", "Poole", true)).toBe(true);
    expect(await repos.control.hasTrustedPlace(userId, "GB", "Weymouth", true)).toBe(false);
    expect(await repos.control.hasTrustedPlace(userId, "GB", null, true)).toBe(true);
  });

  it("a brand-new account has no trusted place yet", async () => {
    expect(await repos.control.countTrustedDevices(userId)).toBe(0);
    expect(await repos.control.hasTrustedPlace(userId, null, null)).toBe(false);
  });
});
