"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { BLOG_STATUSES, type BlogStatus } from "@/lib/db/schema";
import { buildSeedRows } from "@/lib/blog/seed";

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
