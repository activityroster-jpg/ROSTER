import { describe, expect, it } from "vitest";
import { extractEmails, extractNamedRoles, stripHtml } from "@/lib/outreach/research";
import { firstName, footerText, renderTemplate, toHtml } from "@/lib/outreach/writer";
import { scheduleAfter, windowOpen, londonParts } from "@/lib/outreach/engine";
import { emailLooksDeliverable } from "@/lib/outreach/validate";
import { verifySvix } from "@/lib/outreach/svix";
import { campaignSchema } from "@/lib/outreach/schema";
import { DEFAULT_STEPS } from "@/lib/outreach/types";

describe("research helpers", () => {
  it("strips html to text and collects links and mailtos", () => {
    const r = stripHtml(`<html><head><style>p{}</style><script>x()</script></head><body><h1>Rock Sailing &amp; Water Ski Club</h1><p>Contact <a href="mailto:office@rockclub.co.uk?subject=hi">the office</a> or see <a href="/about-us">about</a>.</p></body></html>`);
    expect(r.text).toContain("Rock Sailing & Water Ski Club");
    expect(r.text).not.toContain("x()");
    expect(r.mailtos).toEqual(["office@rockclub.co.uk"]);
    expect(r.links).toContain("/about-us");
  });
  it("extracts plausible emails and drops image-like or placeholder ones", () => {
    const e = extractEmails("Write to Principal@Example-Centre.co.uk. or sales@sentry.io, photo@2x.png", ["info@club.org"]);
    expect(e).toContain("principal@example-centre.co.uk");
    expect(e).toContain("info@club.org");
    expect(e).not.toContain("photo@2x.png");
  });
  it("pairs names with roles by proximity", () => {
    const r = extractNamedRoles("Our team. Jane Smith, Principal, runs the centre. Chief Instructor: Tom O'Brien. The Royal Yachting Association is our governing body.");
    expect(r).toEqual(expect.arrayContaining([{ name: "Jane Smith", role: "Principal" }, { name: "Tom O'Brien", role: "Chief Instructor" }]));
    expect(r.find((x) => x.name.startsWith("Royal"))).toBeUndefined();
  });
});

describe("writer helpers", () => {
  it("first name handles titles and blanks", () => {
    expect(firstName("Dr Jane Smith")).toBe("Jane");
    expect(firstName("Tom")).toBe("Tom");
    expect(firstName("")).toBeNull();
  });
  it("renders placeholders and collapses blank runs", () => {
    expect(renderTemplate("Hi {{first_name}},\n\n\n\n{{hook}}\n\n{{sender}}", { first_name: "Jane", hook: "", sender: "Conor" })).toBe("Hi Jane,\n\nConor");
  });
  it("footer carries sender, company, address and opt-out", () => {
    const f = footerText({ senderName: "Conor at ActivityRoster", company: "ActiveRoster Ltd", address: "1 Street, Town", unsubscribeUrl: "https://x.test/u/abc" });
    expect(f).toContain("ActiveRoster Ltd");
    expect(f).toContain("https://x.test/u/abc");
  });
  it("html escapes and links", () => {
    const h = toHtml("Hi <Jane>\n\nSee https://activityroster.com/pricing");
    expect(h).toContain("&lt;Jane&gt;");
    expect(h).toContain('<a href="https://activityroster.com/pricing">');
  });
});

describe("scheduling", () => {
  const c = { sendWindowStart: 8, sendWindowEnd: 18, weekdaysOnly: true };
  it("knows UK hours and weekends", () => {
    expect(windowOpen(c, new Date("2026-06-10T09:00:00Z"))).toBe(true);   // Wed 10:00 BST
    expect(windowOpen(c, new Date("2026-06-10T17:30:00Z"))).toBe(false);  // Wed 18:30 BST
    expect(windowOpen(c, new Date("2026-06-13T10:00:00Z"))).toBe(false);  // Sat
    expect(windowOpen({ ...c, weekdaysOnly: false }, new Date("2026-06-13T10:00:00Z"))).toBe(true);
  });
  it("pushes follow-ups off weekends", () => {
    const from = new Date("2026-06-11T09:00:00Z"); // Thu
    const next = scheduleAfter(c, from, 2);         // Sat → Mon
    expect(londonParts(next).weekday).toBe(1);
    expect(next.getTime()).toBeGreaterThan(from.getTime() + 3 * 86_400_000);
  });
});

describe("address check", () => {
  const fake = (answers: Record<string, number>) => (async (url: string | URL | Request) => {
    const t = new URL(String(url)).searchParams.get("type")!;
    return new Response(JSON.stringify({ Status: 0, Answer: Array.from({ length: answers[t] ?? 0 }, () => ({ type: 15 })) }), { status: 200 });
  }) as typeof fetch;
  it("rejects bad syntax without a lookup", async () => {
    expect((await emailLooksDeliverable("not-an-email")).ok).toBe(false);
  });
  it("accepts MX, falls back to A, rejects neither", async () => {
    expect((await emailLooksDeliverable("a@club.org", fake({ MX: 1 }))).ok).toBe(true);
    expect((await emailLooksDeliverable("a@club.org", fake({ A: 1 }))).ok).toBe(true);
    expect((await emailLooksDeliverable("a@club.org", fake({}))).ok).toBe(false);
  });
});

describe("svix signature", () => {
  const secret = "whsec_" + btoa("super-secret-key-material");
  const sign = async (id: string, ts: string, body: string) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("super-secret-key-material"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    return "v1," + btoa(String.fromCharCode(...new Uint8Array(sig)));
  };
  it("accepts a fresh, correctly signed body and rejects tampering or stale timestamps", async () => {
    const now = 1_780_000_000;
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "x" } });
    const sig = await sign("msg_1", String(now), body);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now)).toBe(true);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: `v1,abc ${sig}` }, body, now)).toBe(true);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body + " ", now)).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: String(now), signature: sig }, body, now + 600)).toBe(false);
    expect(await verifySvix(secret, { id: null, timestamp: String(now), signature: sig }, body, now)).toBe(false);
  });
});

describe("campaign schema", () => {
  const base = {
    name: "Test", pitch: "ActivityRoster is rostering for RYA centres, with ratio checks.", targetRoles: "Principal", tone: "",
    fromName: "Conor at ActivityRoster", fromEmail: "conor@activityroster.com", replyTo: "", dailyCap: 40, sendWindowStart: 8, sendWindowEnd: 18,
    weekdaysOnly: true, aiPersonalise: true, steps: DEFAULT_STEPS, audience: { regions: [], statuses: [], requireWebsite: true, excludeContactedDays: 90, limit: 200 },
  };
  it("accepts the defaults and rejects an inverted window or a bad sender", () => {
    expect(campaignSchema.safeParse(base).success).toBe(true);
    expect(campaignSchema.safeParse({ ...base, sendWindowStart: 18, sendWindowEnd: 8 }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, fromEmail: "nope" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, steps: [] }).success).toBe(false);
  });
});

describe("london day start", () => {
  it("is midnight London in summer and winter", async () => {
    const { londonDayStart, londonWeekStart, londonMonthStart } = await import("@/lib/outreach/engine");
    expect(londonDayStart(new Date("2026-06-17T15:00:00Z")).toISOString()).toBe("2026-06-16T23:00:00.000Z");
    expect(londonDayStart(new Date("2026-01-14T15:00:00Z")).toISOString()).toBe("2026-01-14T00:00:00.000Z");
    expect(londonDayStart(new Date("2026-06-16T23:30:00Z")).toISOString()).toBe("2026-06-16T23:00:00.000Z"); // 00:30 London on the 17th
    expect(londonWeekStart(new Date("2026-06-17T15:00:00Z")).toISOString()).toBe("2026-06-14T23:00:00.000Z"); // Monday 15th
    expect(londonMonthStart(new Date("2026-06-17T15:00:00Z")).toISOString()).toBe("2026-05-31T23:00:00.000Z");
  });
});
