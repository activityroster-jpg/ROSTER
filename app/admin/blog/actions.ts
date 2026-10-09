"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { BLOG_STATUSES, type BlogStatus } from "@/lib/db/schema";
import { buildSeedRows } from "@/lib/blog/seed";
import { getEnv } from "@/lib/cf/bindings";
import { COVER_PULL_GAP_S } from "@/lib/blog/cover-pacing";
import { findCover, downloadImage, queryForArticle, queryFingerprint, hasStockKey } from "@/lib/blog/stock";

/** `remaining`: covers still to do after a one-at-a-time fetch. `retryAfter`: seconds until the photo library may be asked again. */
export type BlogResult = { ok: boolean; error?: string; message?: string; id?: string; remaining?: number; retryAfter?: number; fetched?: number };

async function platform() {
  await requirePlatformAdmin();
  return new PlatformRepository(await getDb());
}

const ISO_DT = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

function parsePublishAt(v: string): Date | null {
  if (!v || !ISO_DT.test(v)) return null;
  const iso = v.length === 10 ? `${v}T09:00:00Z` : `${v}:00Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Create a post from the admin form. */
export async function createPostAction(_prev: BlogResult, fd: FormData): Promise<BlogResult> {
  const repo = await platform();
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  let slug = slugify(String(fd.get("slug") ?? "") || title);
  // Ensure slug uniqueness.
  if (await repo.getPostBySlug(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const status: BlogStatus = (BLOG_STATUSES as readonly string[]).includes(String(fd.get("status"))) ? (String(fd.get("status")) as BlogStatus) : "draft";
  const publishAt = parsePublishAt(String(fd.get("publishAt") ?? "")) ?? (status === "published" ? new Date() : null);

  const created = await repo.createPost({
    slug,
    title,
    excerpt: String(fd.get("excerpt") ?? "").trim(),
    body: String(fd.get("body") ?? ""),
    category: String(fd.get("category") ?? "Guides").trim() || "Guides",
    tags: String(fd.get("tags") ?? "").trim(),
    author: String(fd.get("author") ?? "").trim() || "The ActivityRoster Team",
    coverEmoji: String(fd.get("coverEmoji") ?? "").trim() || "⛵",
    seoTitle: String(fd.get("seoTitle") ?? "").trim() || `${title} | ActivityRoster`,
    seoDescription: String(fd.get("seoDescription") ?? "").trim() || null,
    status,
    publishAt,
  });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: "Post created", id: created.id };
}

/** Update an existing post. */
export async function updatePostAction(id: string, fd: FormData): Promise<BlogResult> {
  const repo = await platform();
  const existing = await repo.getPostById(id);
  if (!existing) return { ok: false, error: "Post not found" };

  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  let slug = slugify(String(fd.get("slug") ?? "") || title);
  const clash = await repo.getPostBySlug(slug);
  if (clash && clash.id !== id) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const status: BlogStatus = (BLOG_STATUSES as readonly string[]).includes(String(fd.get("status"))) ? (String(fd.get("status")) as BlogStatus) : existing.status;
  const publishAt = parsePublishAt(String(fd.get("publishAt") ?? "")) ?? existing.publishAt ?? (status === "published" ? new Date() : null);

  await repo.updatePost(id, {
    slug,
    title,
    excerpt: String(fd.get("excerpt") ?? "").trim(),
    body: String(fd.get("body") ?? ""),
    category: String(fd.get("category") ?? "Guides").trim() || "Guides",
    tags: String(fd.get("tags") ?? "").trim(),
    author: String(fd.get("author") ?? "").trim() || "The ActivityRoster Team",
    coverEmoji: String(fd.get("coverEmoji") ?? "").trim() || "⛵",
    seoTitle: String(fd.get("seoTitle") ?? "").trim() || null,
    seoDescription: String(fd.get("seoDescription") ?? "").trim() || null,
    status,
    publishAt,
  });
  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  return { ok: true, message: "Saved" };
}

export async function deletePostAction(id: string): Promise<BlogResult> {
  const repo = await platform();
  await repo.deletePost(id);
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: "Deleted" };
}

/** Quick status toggle (publish / unpublish) from the list. */
export async function setPostStatusAction(id: string, status: string): Promise<BlogResult> {
  const repo = await platform();
  if (!(BLOG_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Invalid status" };
  const existing = await repo.getPostById(id);
  if (!existing) return { ok: false, error: "Not found" };
  const publishAt = status === "published" && !existing.publishAt ? new Date() : existing.publishAt;
  await repo.updatePost(id, { status: status as BlogStatus, publishAt });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: status === "published" ? "Published" : "Unpublished" };
}

/**
 * Seed the 100 starter articles: 10 live now, the rest scheduled two per day
 * into the future (they auto-appear as their date arrives). Idempotent — skips
 * any slug that already exists, so it's safe to run more than once.
 */
export async function seedArticlesAction(): Promise<BlogResult> {
  const repo = await platform();
  const rows = buildSeedRows({ liveNow: 10, perDay: 2 });
  let created = 0;
  for (const row of rows) {
    if (await repo.getPostBySlug(row.slug)) continue;
    await repo.createPost(row);
    created++;
  }
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: created ? `Seeded ${created} articles (10 live now, the rest publish 2/day)` : "All articles already present — nothing to seed" };
}

/**
 * Re-sync article CONTENT from the seed into existing posts (body, excerpt,
 * title, category, tags, cover) while preserving each post's publish date and
 * status. Use this after the starter articles are rewritten/expanded so the live
 * blog picks up the new content. Creates any missing article too.
 */
export async function resyncArticlesAction(): Promise<BlogResult> {
  const repo = await platform();
  const rows = buildSeedRows({ liveNow: 10, perDay: 2 });
  let updated = 0;
  let created = 0;
  for (const row of rows) {
    const existing = await repo.getPostBySlug(row.slug);
    if (existing) {
      await repo.updatePost(existing.id, {
        title: row.title,
        excerpt: row.excerpt,
        body: row.body,
        category: row.category,
        tags: row.tags,
        coverEmoji: row.coverEmoji,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      });
      updated++;
    } else {
      await repo.createPost(row);
      created++;
    }
  }
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: `Re-synced content — ${updated} updated${created ? `, ${created} added` : ""}.` };
}

/**
 * The photo library restricts how often it is asked, so cover images are
 * pulled one at a time with at least 20 seconds between pulls. The time of the
 * last pull is kept in KV, so the gap holds across clicks, tabs and admins.
 */
const LAST_PULL_KEY = "blog:stock:last-pull";

/** Seconds to wait before the next pull (0 = go now, and the pull is recorded). */
async function takePullSlot(env: ReturnType<typeof getEnv>): Promise<number> {
  const now = Date.now();
  try {
    const last = Number(await env.TENANT_CACHE.get(LAST_PULL_KEY)) || 0;
    const wait = Math.ceil((last + COVER_PULL_GAP_S * 1000 - now) / 1000);
    if (wait > 0) return wait;
    await env.TENANT_CACHE.put(LAST_PULL_KEY, String(now), { expirationTtl: 3600 });
  } catch { /* KV unavailable: the admin page still spaces its own pulls */ }
  return 0;
}

const waitMessage = (s: number) => `The photo library allows one image every ${COVER_PULL_GAP_S} seconds. Try again in ${s} second${s === 1 ? "" : "s"}.`;

const NO_KEY = "Set a PIXABAY_API_KEY (instant free key at pixabay.com/api/docs) or PEXELS_API_KEY Worker secret first.";

// Timestamped R2 key per fetch so a re-fetch gets a fresh URL (busts the CDN /
// browser cache) rather than silently showing the old cached image. The key also
// carries a fingerprint of the search query the photo was chosen for, so a cover
// fetched for an older, less relevant query shows up as stale (see below).
const newCoverKey = (slug: string, query: string) => `blog/${slug}-q${queryFingerprint(query)}-${Date.now().toString(36)}.jpg`;

/** True when the post has no cover, or its cover was fetched for a different query than the article now wants. */
function coverIsStale(post: { coverImageKey: string | null } & Parameters<typeof queryForArticle>[0]): boolean {
  if (!post.coverImageKey) return true;
  return !post.coverImageKey.includes(`-q${queryFingerprint(queryForArticle(post))}-`);
}

/**
 * Fetch (or re-fetch) a relevant cover image for one post from a free stock API,
 * store it in R2 self-hosted, and save the credit. Avoids photos already used on
 * other articles, and on a re-fetch avoids the article's current photo and deletes
 * the old R2 object. Works as both "fetch" and "re-fetch".
 */
export async function fetchCoverImageAction(postId: string): Promise<BlogResult> {
  const repo = await platform();
  const env = getEnv();
  if (!hasStockKey(env)) return { ok: false, error: NO_KEY };
  const post = await repo.getPostById(postId);
  if (!post) return { ok: false, error: "Post not found" };
  const wait = await takePullSlot(env);
  if (wait > 0) return { ok: false, error: waitMessage(wait), retryAfter: wait };

  // Exclude photos already used elsewhere, plus this post's current one (so a
  // re-fetch actually changes the image).
  const all = await repo.listAllPosts();
  const exclude = new Set(all.filter((p) => p.id !== post.id).map((p) => p.coverImageCreditUrl).filter(Boolean) as string[]);
  if (post.coverImageCreditUrl) exclude.add(post.coverImageCreditUrl);

  const query = queryForArticle(post);
  let candidate;
  try {
    candidate = await findCover(env, query, exclude);
  } catch (e) {
    return { ok: false, error: `Image search failed: ${(e as Error).message}` };
  }
  if (!candidate) return { ok: false, error: "No matching photo found — try again." };

  const key = newCoverKey(post.slug, query);
  try {
    const { body, contentType } = await downloadImage(candidate.downloadUrl);
    await env.DOCS.put(key, body, { httpMetadata: { contentType } });
  } catch (e) {
    return { ok: false, error: `Image download/store failed: ${(e as Error).message}` };
  }
  // Best-effort delete of the previous image so R2 doesn't accumulate orphans.
  if (post.coverImageKey && post.coverImageKey !== key) {
    try { await env.DOCS.delete(post.coverImageKey); } catch { /* ignore */ }
  }

  await repo.updatePost(post.id, {
    coverImageKey: key,
    coverImageCredit: candidate.credit,
    coverImageCreditUrl: candidate.creditUrl,
  });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return { ok: true, message: `Cover updated — photo by ${candidate.credit}` };
}

/**
 * Fetch covers for up to `limit` posts that don't yet have one. Batched to stay
 * within the provider's rate limit and the Worker's per-request subrequest budget
 * — run it a few times to cover the whole blog. Avoids repeating photos.
 */
export async function fetchMissingCoversAction(limit = 6): Promise<BlogResult> {
  return fetchCoversBatch(limit, "missing");
}

/**
 * Replace covers that no longer match their article: every post without a cover,
 * plus every post whose cover was fetched for a different search query than the
 * article now asks for (after the starter articles were given subject-specific
 * image queries). Batched like the missing-cover fetch; run it until it says done.
 */
export async function refreshStaleCoversAction(limit = 6): Promise<BlogResult> {
  return fetchCoversBatch(limit, "stale");
}

async function fetchCoversBatch(limit: number, mode: "missing" | "stale"): Promise<BlogResult> {
  void limit; // one image per call: the admin page repeats it with the 20-second gap
  const repo = await platform();
  const env = getEnv();
  if (!hasStockKey(env)) return { ok: false, error: NO_KEY };
  const all = await repo.listAllPosts();
  const used = new Set(all.map((p) => p.coverImageCreditUrl).filter(Boolean) as string[]);
  const wanted = (p: (typeof all)[number]) => (mode === "missing" ? !p.coverImageKey : coverIsStale(p));
  const todo = all.filter(wanted).slice(0, 1);
  if (todo.length === 0) return { ok: true, message: "All done: every article has a matching cover.", remaining: 0, fetched: 0 };
  const wait = await takePullSlot(env);
  if (wait > 0) return { ok: false, error: waitMessage(wait), retryAfter: wait, remaining: all.filter(wanted).length };
  let done = 0;
  let rateLimited = false;
  for (const post of todo) {
    try {
      const query = queryForArticle(post);
      // On a replace, also avoid the photo currently on this post.
      const exclude = post.coverImageCreditUrl ? new Set([...used, post.coverImageCreditUrl]) : used;
      const candidate = await findCover(env, query, exclude);
      if (!candidate) continue;
      const key = newCoverKey(post.slug, query);
      const { body, contentType } = await downloadImage(candidate.downloadUrl);
      await env.DOCS.put(key, body, { httpMetadata: { contentType } });
      if (post.coverImageKey && post.coverImageKey !== key) {
        try { await env.DOCS.delete(post.coverImageKey); } catch { /* ignore */ }
      }
      await repo.updatePost(post.id, {
        coverImageKey: key,
        coverImageCredit: candidate.credit,
        coverImageCreditUrl: candidate.creditUrl,
      });
      used.add(candidate.creditUrl); // don't reuse it on the next post in this run
      done++;
    } catch (e) {
      if ((e as Error).message?.includes("429")) { rateLimited = true; break; } // stop; let the limit reset
      // otherwise skip this one; the next run will retry it
    }
  }
  const remaining = all.filter(wanted).length - done;
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (rateLimited) return { ok: false, error: `The photo library says too many requests. Wait a minute, then run it again (${remaining} to do).`, remaining };
  const verb = mode === "missing" ? "Fetched" : "Refreshed";
  return { ok: true, message: `${verb} ${done} cover image${done === 1 ? "" : "s"}${remaining > 0 ? `, ${remaining} still to do` : ", all done"}.`, remaining, fetched: done };
}
