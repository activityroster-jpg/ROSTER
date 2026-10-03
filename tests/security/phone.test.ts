import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone, normaliseMobile } from "@/lib/security/phone";

describe("mobile numbers", () => {
  it("normalises UK and Irish numbers as people type them", () => {
    expect(normaliseMobile("07700 900123")).toBe("+447700900123");
    expect(normaliseMobile("(07700) 900-123")).toBe("+447700900123");
    expect(normaliseMobile("+44 7700 900123")).toBe("+447700900123");
    expect(normaliseMobile("0044 7700 900123")).toBe("+447700900123");
    expect(normaliseMobile("447700900123")).toBe("+447700900123");
    expect(normaliseMobile("087 123 4567")).toBe("+353871234567");
    expect(normaliseMobile("+353 87 123 4567")).toBe("+353871234567");
    expect(normaliseMobile("7700900123", "GB")).toBe("+447700900123");
    expect(normaliseMobile("871234567", "IE")).toBe("+353871234567");
  });

  it("rejects junk", () => {
    expect(normaliseMobile("")).toBeNull();
    expect(normaliseMobile("call me")).toBeNull();
    expect(normaliseMobile("0770")).toBeNull();
    expect(normaliseMobile("+1")).toBeNull();
  });

  it("masks for display", () => {
    expect(maskPhone("+447700900123")).toBe("+44 ••• ••• 123");
    expect(maskEmail("conor@example.com")).toBe("c****@example.com");
  });
});
