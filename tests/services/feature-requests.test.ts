import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mail", () => ({ sendEmail: vi.fn(async () => {}), escapeHtml: (s: unknown) => String(s ?? "") }));

import { createTestDb } from "@/tests/helpers/test-db";
import { seedFullOrg } from "@/tests/helpers/seed-fixtures";
import { FeatureRequestRepository } from "@/lib/db/repositories/feature-requests";
import { submitFeatureRequest, FeatureRequestLimitError } from "@/lib/services/feature-requests";
import { featureRequestSchema, featureRequestAdminSchema, FEATURE_REQUEST_DAILY_CAP } from "@/lib/validation/feature-request";
import type { TenantContext } from "@/lib/tenant/context";
import { eraseOrganisationData } from "@/lib/services/export";

const valid = {
  kind: "feature",
  title: "Copy last week's roster forward",
  problem: "Every Sunday we rebuild the same week by hand, which takes an hour.",
  change: "A button to copy one week into the next.",
  importance: "important",
  consentPublic: "on",
};

async function twoCentres() {
  const { db } = createTestDb();
  const a = await seedFullOrg(db, { name: "Alpha Sailing", slug: "alpha", jurisdiction: "england" });
  const b = await seedFullOrg(db, { name: "Bravo Watersports", slug: "bravo", jurisdiction: "england" });
  const ctxA: TenantContext = { organisationId: a.organisationId, slug: "alpha", userId: "user-a", role: "owner" };
  const ctxB: TenantContext = { organisationId: b.organisationId, slug: "bravo", userId: "user-b", role: "owner" };
  const orgA = (await a.repos.control.organisationById(a.organisationId))!;
  return { db, repos: a.repos, ctxA, ctxB, orgA, fr: new FeatureRequestRepository(db) };
}

describe("feature requests: validation", () => {
  it("needs the problem, the change, a title and the consent tick", () => {
    expect(featureRequestSchema.safeParse(valid).success).toBe(true);
    const r = featureRequestSchema.safeParse({ ...valid, problem: "short", title: "", consentPublic: undefined });
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["problem", "title", "consentPublic"]));
  });

  it("turns blank optional answers into null and rejects unknown stages", () => {
    const r = featureRequestSchema.parse({ ...valid, workaround: "", details: "  " });
    expect(r.workaround).toBeNull();
    expect(r.details).toBeNull();
    expect(featureRequestAdminSchema.safeParse({ status: "shipped" }).success).toBe(false);
  });
});

describe("feature requests: privacy and scoping", () => {
  it("keeps a new request off the board until it is reviewed, then shows only the public fields", async () => {
    const { repos, ctxA, ctxB, orgA, fr } = await twoCentres();
    const row = await submitFeatureRequest(repos, ctxA, { organisation: orgA, answers: featureRequestSchema.parse(valid), submitterName: "Sam Owner" });
    expect(row.status).toBe("submitted");
    expect(row.organisationId).toBe(ctxA.organisationId);
    expect(row.publicTitle).toBe(valid.title);

    expect(await fr.board(ctxB)).toEqual([]);
    expect(await fr.board(ctxA)).toEqual([]);
    expect((await fr.listForCentre(ctxA)).map((r) => r.id)).toEqual([row.id]);
    expect(await fr.listForCentre(ctxB)).toEqual([]);
    expect(await fr.findForCentre(ctxB, row.id)).toBeNull();

    await fr.platformUpdate(row.id, { status: "in_review", publicTitle: "Copy a week's roster" });
    const board = await fr.board(ctxB);
    expect(board).toHaveLength(1);
    expect(Object.keys(board[0]!).sort()).toEqual(["createdAt", "id", "kind", "mine", "publicTitle", "status", "voted", "votes"]);
    expect(board[0]!.publicTitle).toBe("Copy a week's roster");
    expect(board[0]!.mine).toBe(false);
    expect(JSON.stringify(board)).not.toContain("Alpha");
    expect(JSON.stringify(board)).not.toContain("Sunday");
    expect((await fr.board(ctxA))[0]!.mine).toBe(true);

    await fr.platformUpdate(row.id, { hidden: true });
    expect(await fr.board(ctxB)).toEqual([]);
  });

  it("logs the request in the centre's audit log", async () => {
    const { repos, ctxA, orgA } = await twoCentres();
    const row = await submitFeatureRequest(repos, ctxA, { organisation: orgA, answers: featureRequestSchema.parse(valid), submitterName: null });
    const log = await repos.tenant.auditLog.list({ organisationId: ctxA.organisationId, slug: "alpha", system: true, reason: "test" });
    expect(log.some((l) => l.entity === "feature_request" && l.entityId === row.id)).toBe(true);
  });

  it("counts one vote per centre, never on its own request or one not yet on the board", async () => {
    const { repos, ctxA, ctxB, orgA, fr } = await twoCentres();
    const row = await submitFeatureRequest(repos, ctxA, { organisation: orgA, answers: featureRequestSchema.parse(valid), submitterName: null });
    expect(await fr.toggleVote(ctxB, row.id)).toBeNull();
    await fr.platformUpdate(row.id, { status: "approved" });
    expect(await fr.toggleVote(ctxA, row.id)).toBeNull();
    expect(await fr.toggleVote(ctxB, row.id)).toEqual({ voted: true });
    expect((await fr.board(ctxB))[0]).toMatchObject({ votes: 1, voted: true });
    expect((await fr.board(ctxA))[0]).toMatchObject({ votes: 1, voted: false, mine: true });
    expect(await fr.toggleVote(ctxB, row.id)).toEqual({ voted: false });
    expect((await fr.board(ctxB))[0]).toMatchObject({ votes: 0, voted: false });
  });

  it("stops a centre after the daily cap", async () => {
    const { repos, ctxA, orgA } = await twoCentres();
    const answers = featureRequestSchema.parse(valid);
    for (let i = 0; i < FEATURE_REQUEST_DAILY_CAP; i++) await submitFeatureRequest(repos, ctxA, { organisation: orgA, answers, submitterName: null });
    await expect(submitFeatureRequest(repos, ctxA, { organisation: orgA, answers, submitterName: null })).rejects.toBeInstanceOf(FeatureRequestLimitError);
  });

  it("goes with the centre when it is erased", async () => {
    const { repos, ctxA, ctxB, orgA, fr } = await twoCentres();
    const row = await submitFeatureRequest(repos, ctxA, { organisation: orgA, answers: featureRequestSchema.parse(valid), submitterName: null });
    await fr.platformUpdate(row.id, { status: "in_review" });
    expect((await eraseOrganisationData(repos, ctxA, { deleteFiles: async () => 0 })).erased).toBe(true);
    expect(await fr.board(ctxB)).toEqual([]);
    expect(await fr.platformList()).toEqual([]);
  });
});
