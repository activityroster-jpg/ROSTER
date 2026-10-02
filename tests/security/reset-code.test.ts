import { describe, it, expect } from "vitest";
import { checkCode, issueCode, CODE_MAX_ATTEMPTS, CODE_SENDS_PER_HOUR, type CodeStore } from "@/lib/security/reset-code";

function memoryStore(): CodeStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async get(k) { return map.get(k) ?? null; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
  };
}

describe("one-time reset codes", () => {
  it("issues a 6-digit code that verifies once", async () => {
    const store = memoryStore();
    const code = await issueCode(store, "pin-reset:u1");
    expect(code).toMatch(/^\d{6}$/);
    expect(await checkCode(store, "pin-reset:u1", code!)).toBe("ok");
    expect(await checkCode(store, "pin-reset:u1", code!)).toBe("expired"); // single use
  });

  it("is scoped per user and rejects wrong codes, locking after too many attempts", async () => {
    const store = memoryStore();
    const code = await issueCode(store, "pin-reset:u1");
    expect(await checkCode(store, "pin-reset:u2", code!)).toBe("expired");
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < CODE_MAX_ATTEMPTS - 1; i++) expect(await checkCode(store, "pin-reset:u1", wrong)).toBe("wrong");
    expect(await checkCode(store, "pin-reset:u1", wrong)).toBe("locked");
    expect(await checkCode(store, "pin-reset:u1", code!)).toBe("expired"); // consumed by the lock
  });

  it("limits how many codes can be sent per hour", async () => {
    const store = memoryStore();
    for (let i = 0; i < CODE_SENDS_PER_HOUR; i++) expect(await issueCode(store, "pin-reset:u1")).not.toBeNull();
    expect(await issueCode(store, "pin-reset:u1")).toBeNull();
  });
});
