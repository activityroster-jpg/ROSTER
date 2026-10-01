import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { BlogAdminList, type PostRow } from "@/components/admin/BlogAdminList";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  await requirePlatformAdmin();
  const repo = new PlatformRepository(await getDb());
  const posts = await repo.listAllPosts();
  const now = Date.now();
  const rows: PostRow[] = posts.map((p) => {
    const at = p.publishAt ? (p.publishAt instanceof Date ? p.publishAt.getTime() : Number(p.publishAt)) : null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      status: p.status,
      publishAt: at ? new Date(at).toISOString() : null,
      live: p.status === "published" && at !== null && at <= now,
      hasCover: Boolean(p.coverImageKey),
      coverUrl: p.coverImageKey ? `/api/blog-image/${p.coverImageKey.replace(/^blog\//, "")}` : null,
    };
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy">Blog</h1>
      <p className="mb-6 text-sm text-slate-500">Write and schedule SEO articles for the public blog. Scheduled posts appear automatically on their publish date.</p>
      <BlogAdminList posts={rows} />
    </div>
  );
}
