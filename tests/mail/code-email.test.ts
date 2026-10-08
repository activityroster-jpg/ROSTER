import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cf/bindings", () => ({ getEnv: () => ({ APP_APEX_DOMAIN: "activityroster.com" }), getDb: async () => null }));

import { codeEmailHtml } from "@/lib/mail/code-email";
import { renderEmail, renderEmailText } from "@/lib/mail";

describe("one-time-code emails", () => {
  it("lead with one plain sentence holding the code, then the details", () => {
    const html = codeEmailHtml({ label: "sign-in code", code: "123456", details: ["It finishes signing in."], footnote: "It expires in 10 minutes." });
    const text = renderEmailText(html);
    expect(text.split("\n")[0]).toBe("Your ActivityRoster sign-in code is 123456");
    expect(text).toContain("It finishes signing in.");
    expect(text.match(/123456/g)).toHaveLength(1);
  });

  it("keep the address in every footer and drop only the copyright year on code emails", () => {
    const body = codeEmailHtml({ label: "sign-in code", code: "123456", footnote: "x" });
    const coded = renderEmail(body, { code: true });
    expect(coded).toContain("71-75 Shelton Street");
    expect(coded).not.toContain("All rights reserved");
    expect(renderEmail(body)).toContain("All rights reserved");
    expect(renderEmailText(body)).toContain("71-75 Shelton Street");
  });

  it("show the company number in the designed and plain-text footers", () => {
    const body = codeEmailHtml({ label: "sign-in code", code: "123456", footnote: "x" });
    expect(renderEmail(body)).toContain("Registered in England &amp; Wales, company number 17505500");
    expect(renderEmailText(body)).toContain("company number 17505500");
  });
});
