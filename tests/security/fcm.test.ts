import { describe, it, expect } from "vitest";
import { parseServiceAccount, sendPush } from "@/lib/push/fcm";
import type { CloudflareEnv } from "@/lib/cf/bindings";

describe("push (FCM)", () => {
  it("parses a service account and rejects garbage", () => {
    expect(parseServiceAccount(JSON.stringify({ project_id: "p", client_email: "e@x", private_key: "k" }))).toMatchObject({ project_id: "p" });
    expect(parseServiceAccount("{nope")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ project_id: "p" }))).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });
  it("is a no-op without configuration (never throws, never sends)", async () => {
    const env = { APP_APEX_DOMAIN: "x.test", APP_ENV: "test" } as CloudflareEnv;
    expect(await sendPush(env, ["token-1"], { title: "Hi" })).toEqual({ sent: 0, dead: [] });
  });
});
