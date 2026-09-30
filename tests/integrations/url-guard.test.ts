import { describe, it, expect } from "vitest";
import { assertSafeFeedUrl, isSafeFeedUrl } from "@/lib/integrations/url-guard";

describe("assertSafeFeedUrl (SSRF guard)", () => {
  it("allows normal https feed URLs", () => {
    expect(assertSafeFeedUrl("https://bookwhen.com/x.ics")).toBe("https://bookwhen.com/x.ics");
    expect(isSafeFeedUrl("https://calendar.google.com/calendar/ical/abc/basic.ics")).toBe(true);
  });

  it("normalises webcal:// to https://", () => {
    expect(assertSafeFeedUrl("webcal://example.com/f.ics")).toBe("https://example.com/f.ics");
  });

  it("blocks loopback, link-local and private hosts", () => {
    for (const bad of [
      "http://localhost/f.ics",
      "http://127.0.0.1/f.ics",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.5/f.ics",
      "http://192.168.1.1/f.ics",
      "http://172.16.0.9/f.ics",
      "http://[::1]/f.ics",
      "http://box.local/f.ics",
    ]) {
      expect(isSafeFeedUrl(bad)).toBe(false);
    }
  });

  it("rejects non-web schemes and junk", () => {
    expect(isSafeFeedUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeFeedUrl("ftp://example.com/f")).toBe(false);
    expect(isSafeFeedUrl("not a url")).toBe(false);
  });
});
