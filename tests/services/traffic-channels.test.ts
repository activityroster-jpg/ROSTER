import { describe, expect, it } from "vitest";
import { classify, deviceOf, isBot, referrerDomain } from "@/lib/analytics/channels";

describe("traffic channels", () => {
  const r = (url: string) => referrerDomain(url);
  it("puts each visit in one channel", () => {
    expect(classify({ referrer: null })).toBe("direct");
    expect(classify({ referrer: r("https://www.google.co.uk/") })).toBe("search");
    expect(classify({ referrer: r("https://duckduckgo.com/") })).toBe("search");
    expect(classify({ referrer: r("https://www.bing.com/search?q=x") })).toBe("search");
    expect(classify({ referrer: r("https://chatgpt.com/") })).toBe("ai");
    expect(classify({ referrer: null, utmSource: "chatgpt.com" })).toBe("ai");
    expect(classify({ referrer: r("https://gemini.google.com/app") })).toBe("ai");
    expect(classify({ referrer: r("https://www.perplexity.ai/search") })).toBe("ai");
    expect(classify({ referrer: r("https://l.facebook.com/l.php") })).toBe("social");
    expect(classify({ referrer: r("https://lnkd.in/abc") })).toBe("social");
    expect(classify({ referrer: r("https://t.co/xyz") })).toBe("social");
    expect(classify({ referrer: null, utmMedium: "email", utmSource: "booklet" })).toBe("email");
    expect(classify({ referrer: r("https://mail.google.com/") })).toBe("email");
    expect(classify({ referrer: r("https://www.rya.org.uk/") })).toBe("other");
    expect(classify({ referrer: null, utmSource: "flyer" })).toBe("other");
  });
  it("reads the device and spots bots", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("desktop");
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")).toBe(false);
  });
});
