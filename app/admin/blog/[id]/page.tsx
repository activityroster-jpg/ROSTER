import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

/** Format a Date/epoch as the value a datetime-local input expects (UTC). */
function toLocalInput(v: Date | number | null): string | undefined {
  if (v == null) return undefined;
  const ms = v instanceof Date ? v.getTime() : Number(v);
  return new Date(ms).toISOString().slice(0, 16);
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const repo = new PlatformRepository(await getDb());
  const post = await repo.getPostById(id);
  if (!post) notFound();

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/admin/blog" className="text-sm text-slate-400 hover:text-navy">← All posts</Link>
        {post.status === "published" ? <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-sm text-teal hover:underline">View on site ↗</a> : null}
      </div>
      <h1 className="mb-6 mt-1 font-display text-2xl font-semibold text-navy">Edit post</h1>
      <PostEditor
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          body: post.body,
          category: post.category,
          tags: post.tags,
          author: post.author,
          coverEmoji: post.coverEmoji,
          seoTitle: post.seoTitle ?? undefined,
          seoDescription: post.seoDescription ?? undefined,
          status: post.status,
          publishAt: toLocalInput(post.publishAt),
        }}
      />
    </div>
  );
}
