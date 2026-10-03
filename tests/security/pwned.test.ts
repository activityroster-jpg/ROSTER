import { describe, expect, it } from "vitest";
import { isPwnedPassword, pwnedCount } from "@/lib/security/pwned";

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const BUCKET = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

const fakeFetch = (body: string, ok = true) =>
  (async (url: RequestInfo | URL) => {
    expect(String(url)).toBe(`https://api.pwnedpasswords.com/range/${BUCKET}`);
    return new Response(body, { status: ok ? 200 : 503 });
  }) as unknown as typeof fetch;

describe("breached-password check", () => {
  it("finds the suffix in the bucket and reports the count", async () => {
    const f = fakeFetch(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${SUFFIX}:3861493\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2`);
    expect(await pwnedCount("password", f)).toBe(3861493);
    expect(await isPwnedPassword("password", f)).toBe(true);
  });

  it("a bucket without the suffix means not breached", async () => {
    const f = fakeFetch("0018A45C4D1DEF81644B54AB7F969B88D65:3");
    expect(await pwnedCount("password", f)).toBe(0);
    expect(await isPwnedPassword("password", f)).toBe(false);
  });

  it("an outage never blocks: unknown, not breached", async () => {
    expect(await pwnedCount("password", fakeFetch("", false))).toBeNull();
    const throwing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await isPwnedPassword("password", throwing)).toBe(false);
  });
});
