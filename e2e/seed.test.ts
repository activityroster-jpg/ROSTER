/**
 * Browser-test seed: a made-up centre ("Test Bay Sailing", slug e2e) with an
 * owner, one instructor with the app, and a course next week with nobody on
 * it yet. Writes into the local D1 file given by SEED_DB (wrangler's local
 * database). Run by the browser-tests workflow; never touches a real database.
 */
import { test } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { schema, account, user } from "@/lib/db/schema";
import { createRepositories } from "@/lib/db/repositories";
import { seedOrganisationDefaults } from "@/lib/seed/seed";
import { hashPin } from "@/lib/auth/pin";
import type { Database as Db } from "@/lib/db/client";
import type { SystemTenantContext } from "@/lib/tenant/context";
import { E2E } from "./fixtures";

test("seed the browser-test centre", async () => {
  const raw = new Database(process.env.SEED_DB!);
  raw.pragma("foreign_keys = ON");
  const db = drizzle(raw, { schema }) as unknown as Db;
  const repos = createRepositories(db);
  const t = repos.tenant;
  const hash = await hashPassword(E2E.password);
  const pin = await hashPin(E2E.pin);

  const org = await repos.control.createOrganisation({ name: "Test Bay Sailing", slug: E2E.slug, jurisdiction: "england", plan: "rostering", status: "active", subscriptionStatus: "active", tier: "standard" } as never);
  const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "browser-test seed" };
  await seedOrganisationDefaults(t, ctx, "england");
  const settings = (await t.orgSettings.list(ctx))[0]!;
  await t.orgSettings.update(ctx, settings.id, { enforceAvailabilityChecks: false });

  const person = async (name: string, email: string, role: "owner" | "instructor") => {
    const u = await repos.control.createUser({ name, email });
    await db.update(user).set({ emailVerified: true, pinHash: pin } as never).where(eq(user.id, u.id));
    await db.insert(account).values({ accountId: u.id, providerId: "credential", userId: u.id, password: hash });
    await repos.control.createMembership({ userId: u.id, organisationId: org.id, role }, "active");
    return u.id;
  };
  await person("Olive Owner", E2E.owner, "owner");
  const kimUser = await person("Kim Instructor", E2E.instructor, "instructor");
  const kim = await t.instructor.insert(ctx, { name: "Kim Instructor", email: E2E.instructor, employmentType: "freelance", status: "active", userId: kimUser } as never);

  const types = await t.qualificationType.list(ctx);
  const di = types.find((q) => q.code === "DI") ?? types.find((q) => q.discipline === "dinghy")!;
  await t.qualification.insert(ctx, { instructorId: kim.id, qualificationTypeId: di.id, certNo: "E2E-1", issueDate: "2025-01-01", expiryDate: null, verified: true });

  const ct = (await t.courseType.list(ctx)).find((c) => c.active)!;
  const course = await t.course.insert(ctx, { courseTypeId: ct.id, name: E2E.course, capacity: 4, ratio: ct.studentsPerInstructor, status: "scheduled" } as never);
  await t.courseSession.insert(ctx, { courseId: course.id, date: E2E.day, slot: "AM", startAt: new Date(`${E2E.day}T09:00:00Z`), endAt: new Date(`${E2E.day}T12:00:00Z`) });
  console.log("seeded", org.slug, E2E.day);
});
