import { gte, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/db/repositories";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { helpQuestion } from "@/lib/db/schema";
import { isGhostContext, type AnyTenantContext, type SystemTenantContext, type TenantContext } from "@/lib/tenant/context";
import type { HelpReply } from "@/lib/help/search";

/**
 * What the help assistant keeps (decided 5 Oct): the questions office users
 * ask, for 30 days, so we can see what the guides don't answer. Never the
 * answers, never who asked, and nothing from the public site.
 */
export const HELP_QUESTION_DAYS = 30;
const DAY = 86_400_000;

/** Record an office user's question. Platform admins viewing a centre are not recorded. */
export async function recordHelpQuestion(
  repos: Repositories,
  ctx: TenantContext,
  entry: { question: string; reply: HelpReply; path: string | null },
): Promise<boolean> {
  if (isGhostContext(ctx)) return false;
  // A read-only centre (trial over) can still ask; the log is ours, not an edit to their data.
  const sys: SystemTenantContext = { organisationId: ctx.organisationId, slug: ctx.slug, system: true, reason: "help question log" };
  await repos.tenant.helpQuestion.insert(sys, {
    question: entry.question.trim().slice(0, 300),
    topic: entry.reply.answer?.topic ?? null,
    found: entry.reply.kind !== "not-found",
    path: entry.path ? entry.path.split(/[?#]/)[0]!.slice(0, 200) : null,
  });
  return true;
}

/** Delete one centre's questions older than 30 days. */
export async function purgeHelpQuestions(repos: Repositories, ctx: AnyTenantContext, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - HELP_QUESTION_DAYS * DAY);
  const old = await repos.tenant.helpQuestion.list(ctx, lt(helpQuestion.createdAt, cutoff));
  let removed = 0;
  for (const row of old) removed += await repos.tenant.helpQuestion.delete(ctx, row.id);
  return removed;
}

export interface HelpQuestionRow {
  id: string;
  centreName: string;
  centreSlug: string;
  question: string;
  topic: string | null;
  found: boolean;
  path: string | null;
  createdAt: Date;
}

/** Dev Center: every centre's questions from the last 30 days, newest first. */
export async function recentHelpQuestions(db: Database, now = new Date()): Promise<HelpQuestionRow[]> {
  const repos = createRepositories(db);
  const orgs = await new PlatformRepository(db).listOrganisations();
  const cutoff = new Date(now.getTime() - HELP_QUESTION_DAYS * DAY);
  const out: HelpQuestionRow[] = [];
  for (const org of orgs) {
    const ctx: SystemTenantContext = { organisationId: org.id, slug: org.slug, system: true, reason: "dev center help questions" };
    const rows = await repos.tenant.helpQuestion.list(ctx, gte(helpQuestion.createdAt, cutoff));
    for (const r of rows) {
      out.push({ id: r.id, centreName: org.name, centreSlug: org.slug, question: r.question, topic: r.topic, found: Boolean(r.found), path: r.path, createdAt: r.createdAt });
    }
  }
  return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
