import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/test-db";
import { ControlPlaneRepository } from "@/lib/db/repositories/control-plane";

describe("PIN attempts are counted atomically", () => {
  it("twenty guesses at once get five attempts between them; a lapsed lock starts again", async () => {
    const { db } = createTestDb();
    const control = new ControlPlaneRepository(db);
    const u = await control.createUser({ name: "Ellie", email: "ellie@pin.test" });
    const results = await Promise.all(Array.from({ length: 20 }, () => control.claimPinAttempt(u.id, 5)));
    expect(results.filter((r) => r !== null).sort()).toEqual([1, 2, 3, 4, 5]);
    // The fifth failed: locked for 15 minutes. Nothing more while locked.
    const now = Date.now();
    await control.lockPin(u.id, new Date(now + 15 * 60_000));
    expect(await control.claimPinAttempt(u.id, 5, new Date(now + 60_000))).toBeNull();
    // After the lock runs out the count starts at one.
    expect(await control.claimPinAttempt(u.id, 5, new Date(now + 16 * 60_000))).toBe(1);
    await control.resetPinFailures(u.id);
    expect(await control.claimPinAttempt(u.id, 5)).toBe(1);
  });
});
