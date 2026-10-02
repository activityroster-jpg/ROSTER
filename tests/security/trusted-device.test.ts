import { describe, it, expect } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { createRepositories } from "@/lib/db/repositories";

describe("trusted devices", () => {
  it("matches only the same user × device × IP × country, and forgets on demand", async () => {
    const { db } = createTestDb();
    const { control } = createRepositories(db);
    const u = await control.createUser({ name: "Dev", email: "dev@club.test" });
    const other = await control.createUser({ name: "Other", email: "other@club.test" });

    expect(await control.countTrustedDevices(u.id)).toBe(0);
    await control.trustDevice({ userId: u.id, deviceId: "d1", ip: "1.2.3.4", country: "GB", userAgent: "UA" });

    expect(await control.isTrustedDevice(u.id, "d1", "1.2.3.4", "GB")).toBe(true);
    expect(await control.isTrustedDevice(u.id, "d1", "9.9.9.9", "GB")).toBe(false); // new IP
    expect(await control.isTrustedDevice(u.id, "d1", "1.2.3.4", "IE")).toBe(false); // new country
    expect(await control.isTrustedDevice(u.id, "d2", "1.2.3.4", "GB")).toBe(false); // new device
    expect(await control.isTrustedDevice(other.id, "d1", "1.2.3.4", "GB")).toBe(false); // another user

    // Re-trusting the same device/IP updates rather than duplicates.
    await control.trustDevice({ userId: u.id, deviceId: "d1", ip: "1.2.3.4", country: "GB", userAgent: "UA2" });
    await control.trustDevice({ userId: u.id, deviceId: "d1", ip: "9.9.9.9", country: "GB", userAgent: "UA2" });
    expect(await control.countTrustedDevices(u.id)).toBe(2);
    expect((await control.listTrustedDevices(u.id))[0]!.userAgent).toBe("UA2");

    expect(await control.forgetTrustedDevices(u.id)).toBe(2);
    expect(await control.isTrustedDevice(u.id, "d1", "1.2.3.4", "GB")).toBe(false);
  });
});
