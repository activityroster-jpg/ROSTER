import { beforeEach, describe, expect, it } from "vitest";
import { answerQuestion, suggestionsForPage, tokens } from "@/lib/help/search";
import { FAQ } from "@/lib/help/faq";
import { SECTIONS } from "@/lib/learn/sections";
import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { purgeHelpQuestions, recentHelpQuestions, recordHelpQuestion } from "@/lib/services/help";
import type { Database } from "@/lib/db/client";
import type { TenantContext } from "@/lib/tenant/context";

const topicOf = (q: string, path = "/office") => answerQuestion(q, path).answer?.topic;

describe("help assistant search (no AI: the guides only)", () => {
  it("answers common setup questions from the right guide", () => {
    expect(topicOf("How do I add instructors?")).toBe("staff");
    expect(topicOf("invite my team")).toBe("staff");
    expect(topicOf("publish the roster")).toBe("rota");
    expect(topicOf("connect booking system")).toBe("integrations");
    expect(topicOf("how do i add a boat to the system")).toBe("equipment");
    expect(topicOf("under 18 hours")).toBe("young-workers");
    expect(topicOf("export my data")).toBe("data");
    expect(topicOf("forgot my password")).toBe("getting-started");
    expect(topicOf("who can see payroll")).toBe("roles");
    expect(topicOf("is this AI?")).toBe("help-assistant");
    expect(topicOf("what does it cost", "/pricing")).toBe("plans");
  });

  it("says it doesn't know rather than guessing", () => {
    expect(answerQuestion("banana").kind).toBe("not-found");
    expect(answerQuestion("what is the weather in paris").kind).toBe("not-found");
    expect(answerQuestion("   ").kind).toBe("not-found");
  });

  it("handles greetings and thanks without searching", () => {
    expect(answerQuestion("hello").kind).toBe("smalltalk");
    expect(answerQuestion("thanks!").kind).toBe("smalltalk");
  });

  it("always links to a real Learning Centre section", () => {
    const ids = new Set(SECTIONS.map((s) => s.id));
    for (const f of FAQ) expect(ids.has(f.topic), `FAQ ${f.id} → ${f.topic}`).toBe(true);
    const r = answerQuestion("How do I create a course?");
    expect(r.answer?.link).toMatch(/^\/learn\?topic=/);
    for (const rel of r.related) expect(ids.has(rel.topic)).toBe(true);
  });

  it("folds synonyms and simple plurals", () => {
    expect(tokens("Boats and dinghies")).toEqual(["equipment", "equipment"]);
    expect(tokens("rota")).toEqual(tokens("schedule"));
  });

  it("suggests questions that fit the page", () => {
    const staff = suggestionsForPage("/office/staff");
    expect(staff.length).toBeGreaterThan(0);
    for (const s of staff) expect(answerQuestion(s, "/office/staff").kind).toBe("answer");
    expect(suggestionsForPage("/some/unknown/page").length).toBeGreaterThan(0);
  });

  it("documents itself in the Learning Centre", () => {
    expect(SECTIONS.some((s) => s.id === "help-assistant")).toBe(true);
  });
});

describe("help questions: kept 30 days, office users only, per centre", () => {
  let db: Database;
  let a: Awaited<ReturnType<typeof seedFullOrg>>;
  let b: Awaited<ReturnType<typeof seedFullOrg>>;
  let ctxA: TenantContext;

  beforeEach(async () => {
    ({ db } = createTestDb());
    a = await seedFullOrg(db, { name: "Alpha SC", slug: "alpha", jurisdiction: "england" });
    b = await seedFullOrg(db, { name: "Bravo SC", slug: "bravo", jurisdiction: "england" });
    ctxA = { organisationId: a.organisationId, slug: "alpha", userId: "user-a", role: "admin" };
  });

  it("records the question, page and matched guide, but not the answer or who asked", async () => {
    const reply = answerQuestion("How do I publish the roster?", "/office/rota");
    expect(await recordHelpQuestion(a.repos, ctxA, { question: "How do I publish the roster?", reply, path: "/office/rota?week=2026-10-05" })).toBe(true);
    const rows = (await a.repos.tenant.helpQuestion.list(a.ctx)).filter((r) => r.question.includes("publish"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ topic: "rota", found: true, path: "/office/rota" });
    expect(Object.keys(rows[0]!)).not.toContain("answer");
    expect(Object.keys(rows[0]!)).not.toContain("userId");
  });

  it("records a not-found question so the guides can be improved", async () => {
    await recordHelpQuestion(a.repos, ctxA, { question: "banana", reply: answerQuestion("banana"), path: null });
    const row = (await a.repos.tenant.helpQuestion.list(a.ctx)).find((r) => r.question === "banana");
    expect(row).toMatchObject({ found: false, topic: null });
  });

  it("still records for a read-only centre, but never for a platform admin viewing one", async () => {
    expect(await recordHelpQuestion(a.repos, { ...ctxA, readOnly: "trial" }, { question: "trial over q", reply: answerQuestion("trial"), path: null })).toBe(true);
    expect(await recordHelpQuestion(a.repos, { ...ctxA, ghost: true } as TenantContext, { question: "ghost q", reply: answerQuestion("trial"), path: null })).toBe(false);
    const qs = (await a.repos.tenant.helpQuestion.list(a.ctx)).map((r) => r.question);
    expect(qs).toContain("trial over q");
    expect(qs).not.toContain("ghost q");
  });

  it("purges questions older than 30 days, and only in the centre swept", async () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const old = new Date(now.getTime() - 31 * 86_400_000);
    const fresh = new Date(now.getTime() - 29 * 86_400_000);
    await a.repos.tenant.helpQuestion.insert(a.ctx, { question: "old A", found: true, createdAt: old });
    await a.repos.tenant.helpQuestion.insert(a.ctx, { question: "fresh A", found: true, createdAt: fresh });
    await b.repos.tenant.helpQuestion.insert(b.ctx, { question: "old B", found: true, createdAt: old });
    const removed = await purgeHelpQuestions(a.repos, a.ctx, now);
    expect(removed).toBeGreaterThanOrEqual(1);
    const left = (await a.repos.tenant.helpQuestion.list(a.ctx)).map((r) => r.question);
    expect(left).toContain("fresh A");
    expect(left).not.toContain("old A");
    expect((await b.repos.tenant.helpQuestion.list(b.ctx)).map((r) => r.question)).toContain("old B");
  });

  it("the Dev Center list shows the last 30 days across centres, newest first", async () => {
    const now = new Date();
    await a.repos.tenant.helpQuestion.insert(a.ctx, { question: "ancient", found: false, createdAt: new Date(now.getTime() - 40 * 86_400_000) });
    const rows = await recentHelpQuestions(db, now);
    expect(rows.map((r) => r.question)).not.toContain("ancient");
    expect(new Set(rows.map((r) => r.centreSlug))).toEqual(new Set(["alpha", "bravo"]));
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(rows[i]!.createdAt.getTime());
  });
});

describe("help assistant suggestions read as questions", () => {
  it("every suggestion is a question that finds its own answer", () => {
    for (const path of ["/", "/pricing", "/office", "/office/staff", "/office/courses", "/office/rota", "/office/settings", "/office/equipment"]) {
      for (const s of suggestionsForPage(path)) {
        expect(s.endsWith("?") || s.endsWith("now?"), `${path}: ${s}`).toBe(true);
        expect(answerQuestion(s, path).kind, `${path}: ${s}`).toBe("answer");
      }
    }
    expect(suggestionsForPage("/")).toEqual(["How does setup work?", "How much does it cost?", "Is there a free trial?"]);
  });
});
