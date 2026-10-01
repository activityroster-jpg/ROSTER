"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { BLOG_STATUSES, type BlogStatus } from "@/lib/db/schema";
import { buildSeedRows } from "@/lib/blog/seed";
import { getEnv } from "@/lib/cf/bindings";
import { findCover, downloadImage, queryForArticle, hasStockKey } from "@/lib/blog/stock";

export type BlogResult = { ok: boolean; error?: string; message?: string; id?: string };

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

const NO_KEY = "Set a PIXABAY_API_KEY (instant free key at pixabay.com/api/docs) or PEXELS_API_KEY Worker secret first.";

/**
 * Fetch a relevant cover image for one post from a free stock API (Pixabay or
 * Pexels), store it in R2 under blog/<slug>.jpg (self-hosted for SEO), and save
 * the credit. Returns the credited photographer on success.
 */
export async function fetchCoverImageAction(postId: string): Promise<BlogResult> {
  const repo = await platform();
  const env = getEnv();
  if (!hasStockKey(env)) return { ok: false, error: NO_KEY };
  const post = await repo.getPostById(postId);
  if (!post) return { ok: false, error: "Post not found" };

  let candidate;
  try {
    candidate = await findCover(env, queryForArticle(post));
  } catch (e) {
    return { ok: false, error: `Image search failed: ${(e as Error).message}` };
  }
  if (!candidate) return { ok: false, error: "No matching photo found — try a different title/tag." };

  try {
    const { body, contentType } = await downloadImage(candidate.downloadUrl);
    await env.DOCS.put(`blog/${post.slug}.jpg`, body, { httpMetadata: { contentType } });
  } catch (e) {
    return { ok: false, error: `Image download/store failed: ${(e as Error).message}` };
  }

  await repo.updatePost(post.id, {
    coverImageKey: `blog/${post.slug}.jpg`,
    coverImageCredit: candidate.credit,
    coverImageCreditUrl: candidate.creditUrl,
  });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return { ok: true, message: `Cover set — photo by ${candidate.credit}` };
}

/**
 * Fetch covers for up to `limit` posts that don't yet have one. Batched to stay
 * within the provider's rate limit and the Worker's per-request subrequest budget
 * — run it a few times to cover the whole blog.
 */
export async function fetchMissingCoversAction(limit = 10): Promise<BlogResult> {
  const repo = await platform();
  const env = getEnv();
  if (!hasStockKey(env)) return { ok: false, error: NO_KEY };
  const all = await repo.listAllPosts();
  const missing = all.filter((p) => !p.coverImageKey).slice(0, limit);
  let done = 0;
  for (const post of missing) {
    try {
      const candidate = await findCover(env, queryForArticle(post));
      if (!candidate) continue;
      const { body, contentType } = await downloadImage(candidate.downloadUrl);
      await env.DOCS.put(`blog/${post.slug}.jpg`, body, { httpMetadata: { contentType } });
      await repo.updatePost(post.id, {
        coverImageKey: `blog/${post.slug}.jpg`,
        coverImageCredit: candidate.credit,
        coverImageCreditUrl: candidate.creditUrl,
      });
      done++;
    } catch {
      // skip this one; the next run will retry it
    }
  }
  const remaining = all.filter((p) => !p.coverImageKey).length - done;
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, message: `Fetched ${done} cover image${done === 1 ? "" : "s"}${remaining > 0 ? ` — ${remaining} still to do, run again` : " — all done"}.` };
}
