import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { PREVIEW_COOKIE, isPreviewGated, pinMatches, previewToken, safeNext } from "@/lib/preview/gate";

const req = (url: string, cookie?: string) => new NextRequest(url, { headers: { host: new URL(url).host, ...(cookie ? { cookie } : {}) } });
const rewrittenTo = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("the Coming soon gate", () => {
  // The deploy workflows set their own apex (staging uses staging.activityroster.com); pin it here.
  const saved = { apex: process.env.APP_APEX_DOMAIN, gate: process.env.PREVIEW_GATE, pin: process.env.PREVIEW_PIN_SHA256 };
  beforeAll(() => { process.env.APP_APEX_DOMAIN = "activityroster.com"; process.env.PREVIEW_GATE = "on"; delete process.env.PREVIEW_PIN_SHA256; });
  afterAll(() => {
    for (const [k, v] of [["APP_APEX_DOMAIN", saved.apex], ["PREVIEW_GATE", saved.gate], ["PREVIEW_PIN_SHA256", saved.pin]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  it("covers the public pages, not the app, sign-in, legal pages or the guides", () => {
    for (const p of ["/", "/pricing", "/compare/rotaready", "/blog/some-post", "/demo", "/contact", "/signup", "/book"]) expect(isPreviewGated(p)).toBe(true);
    for (const p of ["/privacy", "/terms", "/cookies", "/learn", "/login", "/app", "/portal", "/office", "/api/health", "/privacy-request", "/subprocessors", "/coming-soon", "/admin"]) expect(isPreviewGated(p)).toBe(false);
  });

  it("checks the PIN against its hash only, and only sends people to paths on this site", async () => {
    expect(await pinMatches("123123")).toBe(true);
    expect(await pinMatches("123124")).toBe(false);
    expect(await pinMatches("")).toBe(false);
    expect(safeNext("/pricing")).toBe("/pricing");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
  });

  it("shows Coming soon at the home page's own address until the PIN cookie is there", async () => {
    const shut = await middleware(req("https://activityroster.com/"));
    expect(rewrittenTo(shut)).toContain("/coming-soon?next=%2F");
    expect(shut.headers.get("x-robots-tag")).toBe("noindex");
    const www = await middleware(req("https://www.activityroster.com/pricing"));
    expect(rewrittenTo(www)).toContain("/coming-soon");
    const open = await middleware(req("https://activityroster.com/", `${PREVIEW_COOKIE}=${await previewToken()}`));
    expect(rewrittenTo(open)).toBeNull();
    const wrongCookie = await middleware(req("https://activityroster.com/", `${PREVIEW_COOKIE}=nope`));
    expect(rewrittenTo(wrongCookie)).toContain("/coming-soon");
  });

  it("is off unless PREVIEW_GATE=on: the home page is open to everyone (site opened 6 Oct)", async () => {
    delete process.env.PREVIEW_GATE;
    try {
      expect(rewrittenTo(await middleware(req("https://activityroster.com/")))).toBeNull();
      expect(rewrittenTo(await middleware(req("https://www.activityroster.com/pricing")))).toBeNull();
    } finally {
      process.env.PREVIEW_GATE = "on";
    }
  });

  it("leaves legal pages and centre subdomains alone", async () => {
    expect(rewrittenTo(await middleware(req("https://activityroster.com/privacy")))).toBeNull();
    const centre = await middleware(req("https://yeadon.activityroster.com/"));
    expect(rewrittenTo(centre)).toBeNull();
    expect(centre.headers.get("location")).toContain("/office");
  });
});
