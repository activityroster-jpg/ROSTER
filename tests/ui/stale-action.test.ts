import { describe, expect, it } from "vitest";
import { isStaleActionError } from "@/lib/ui/stale-action";

describe("isStaleActionError", () => {
  it("recognises a save from a page left open across a deploy (10 Oct report)", () => {
    expect(isStaleActionError('Server Action "60f0ea72016bd6b282af6c827353705c7e924b351b" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action')).toBe(true);
    expect(isStaleActionError("An unexpected response was received from the server.")).toBe(true);
  });
  it("leaves real errors alone", () => {
    expect(isStaleActionError("Cannot read properties of undefined (reading 'id')")).toBe(false);
    expect(isStaleActionError("")).toBe(false);
    expect(isStaleActionError(undefined)).toBe(false);
  });
});
