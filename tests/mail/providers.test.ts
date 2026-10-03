import { describe, expect, it } from "vitest";
import { checkFromAllowed, deliver, MailSendError, providersFor } from "@/lib/mail/providers";

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };
/** A fetch that answers each URL from a script and records what was sent. */
function fakeFetch(script: Record<string, () => Response | Error>, calls: Call[] = []) {
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")), headers: (init?.headers ?? {}) as Record<string, string> });
    const r = script[url]?.();
    if (r instanceof Error) throw r;
    return r ?? new Response("unknown", { status: 404 });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}
const RESEND = "https://api.resend.com/emails";
const POSTMARK = "https://api.postmarkapp.com/email";
const msg = { from: "ActivityRoster <no-reply@activityroster.com>", to: "a@b.test", subject: "Hi", html: "<p>hi</p>", text: "hi" };

describe("mail providers", () => {
  it("orders providers by what is configured and MAIL_PRIMARY", () => {
    expect(providersFor({})).toEqual([]);
    expect(providersFor({ RESEND_API_KEY: "r" })).toEqual(["resend"]);
    expect(providersFor({ RESEND_API_KEY: "r", POSTMARK_SERVER_TOKEN: "p" })).toEqual(["resend", "postmark"]);
    expect(providersFor({ RESEND_API_KEY: "r", POSTMARK_SERVER_TOKEN: "p", MAIL_PRIMARY: "postmark" })).toEqual(["postmark", "resend"]);
    expect(providersFor({ RESEND_API_KEY: "r", MAIL_PRIMARY: "postmark" })).toEqual(["resend"]);
  });

  it("sends through Resend and returns its id", async () => {
    const { fetch, calls } = fakeFetch({ [RESEND]: () => new Response(JSON.stringify({ id: "re_1" })) });
    const r = await deliver({ RESEND_API_KEY: "r" }, msg, "system", fetch);
    expect(r).toEqual({ id: "re_1", provider: "resend", failedOver: false, firstError: undefined });
    expect(calls[0]!.headers.Authorization).toBe("Bearer r");
  });

  it("uses the news key for the outreach stream when one exists", async () => {
    const { fetch, calls } = fakeFetch({ [RESEND]: () => new Response(JSON.stringify({ id: "re_2" })) });
    await deliver({ RESEND_API_KEY: "sys", RESEND_API_KEY_NEWS: "news" }, { ...msg, from: "Conor <conor@news.activityroster.com>" }, "news", fetch);
    expect(calls[0]!.headers.Authorization).toBe("Bearer news");
    await deliver({ RESEND_API_KEY: "sys", RESEND_API_KEY_NEWS: "news" }, msg, "system", fetch);
    expect(calls[1]!.headers.Authorization).toBe("Bearer sys");
  });

  it("fails over to Postmark when Resend is down or rate-limited", async () => {
    for (const down of [() => new Error("ECONNRESET"), () => new Response("busy", { status: 503 }), () => new Response("slow down", { status: 429 })]) {
      const { fetch, calls } = fakeFetch({ [RESEND]: down, [POSTMARK]: () => new Response(JSON.stringify({ MessageID: "pm_1" })) });
      const r = await deliver({ RESEND_API_KEY: "r", POSTMARK_SERVER_TOKEN: "p" }, msg, "system", fetch);
      expect(r.provider).toBe("postmark");
      expect(r.failedOver).toBe(true);
      expect(r.id).toBe("pm_1");
      expect(r.firstError).toMatch(/Resend/);
      expect(calls[1]!.headers["X-Postmark-Server-Token"]).toBe("p");
      expect(calls[1]!.body.MessageStream).toBe("outbound");
    }
  });

  it("does not fail over on a 4xx that means the message itself is wrong", async () => {
    const { fetch, calls } = fakeFetch({ [RESEND]: () => new Response("domain not verified", { status: 403 }), [POSTMARK]: () => new Response(JSON.stringify({ MessageID: "pm" })) });
    await expect(deliver({ RESEND_API_KEY: "r", POSTMARK_SERVER_TOKEN: "p" }, msg, "system", fetch)).rejects.toBeInstanceOf(MailSendError);
    expect(calls).toHaveLength(1);
  });

  it("reports both errors when every provider fails", async () => {
    const { fetch } = fakeFetch({ [RESEND]: () => new Response("x", { status: 500 }), [POSTMARK]: () => new Error("timeout") });
    await expect(deliver({ RESEND_API_KEY: "r", POSTMARK_SERVER_TOKEN: "p" }, msg, "system", fetch)).rejects.toThrow(/Resend 500.*then Postmark unreachable/);
  });

  it("restricts outreach to the outreach domain once one is configured", () => {
    const env = { OUTREACH_FROM_DOMAIN: "news.activityroster.com" };
    expect(checkFromAllowed(env, { from: "Conor <conor@news.activityroster.com>" }, "news")).toBeNull();
    expect(checkFromAllowed(env, { from: "conor@activityroster.com" }, "news")).toMatch(/must send from @news/);
    expect(checkFromAllowed(env, { from: "no-reply@activityroster.com" }, "system")).toBeNull();
    expect(checkFromAllowed({}, { from: "anything@anywhere.test" }, "news")).toBeNull();
  });

  it("maps outreach to Postmark's broadcast stream and carries headers", async () => {
    const { fetch, calls } = fakeFetch({ [POSTMARK]: () => new Response(JSON.stringify({ MessageID: "pm_b" })) });
    await deliver({ POSTMARK_SERVER_TOKEN: "p" }, { ...msg, headers: { "List-Unsubscribe": "<https://x>" }, tags: [{ name: "campaign", value: "c1" }] }, "news", fetch);
    expect(calls[0]!.body.MessageStream).toBe("broadcast");
    expect(calls[0]!.body.Headers).toEqual([{ Name: "List-Unsubscribe", Value: "<https://x>" }]);
    expect(calls[0]!.body.Tag).toBe("campaign:c1");
  });
});
