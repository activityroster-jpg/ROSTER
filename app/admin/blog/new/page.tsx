import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { PostEditor } from "@/components/admin/PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requirePlatformAdmin();
  return (
    <div>
      <Link href="/admin/blog" className="text-sm text-slate-400 hover:text-navy">← All posts</Link>
      <h1 className="mb-6 mt-1 font-display text-2xl font-semibold text-navy">New post</h1>
      <PostEditor initial={{ status: "draft", coverEmoji: "⛵", author: "The ActivityRoster Team", category: "Guides" }} />
    </div>
  );
}
