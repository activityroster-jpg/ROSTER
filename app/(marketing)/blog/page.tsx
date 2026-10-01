import Link from "next/link";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { coverImageFor } from "@/lib/blog/images";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blog — Running an RYA Centre or Club | ActivityRoster",
  description: "Practical guides on running RYA sailing schools and clubs: courses, safety, staff, marketing and growth.",
};

const fmtDate = (v: Date | number | null) => {
  if (v == null) return "";
  const ms = v instanceof Date ? v.getTime() : Number(v);
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

export default async function BlogIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const pageSize = 18;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * pageSize;

  let posts: Awaited<ReturnType<PlatformRepository["listPublishedPosts"]>> = [];
  let total = 0;
  try {
    const repo = new PlatformRepository(await getDb());
    [posts, total] = await Promise.all([repo.listPublishedPosts(pageSize, offset), repo.countPublishedPosts()]);
  } catch {
    // table may not exist yet before migration — render an empty state
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Blog</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy sm:text-4xl">Running an RYA centre or club</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Practical guides for sailing schools and clubs — courses, safety and compliance, instructors, marketing and growth.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-card border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500">New articles are on their way — check back soon.</p>
        </div>
      ) : (
        <>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm transition hover:border-teal hover:shadow">
                <div className="relative h-36 w-full overflow-hidden">
                  <img src={coverImageFor(p.slug, p.category)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/30 to-transparent" />
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-xl shadow">{p.coverEmoji}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-teal">{p.category}</span>
                  <h2 className="mt-1 font-display text-lg font-semibold text-navy group-hover:text-teal">{p.title}</h2>
                  <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-3">{p.excerpt}</p>
                  <span className="mt-3 text-xs text-slate-400">{fmtDate(p.publishAt)}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-10 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? <Link href={`/blog?page=${page - 1}`} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-navy hover:bg-slate-50">← Newer</Link> : <span />}
              <span className="text-slate-500">Page {page} of {totalPages}</span>
              {page < totalPages ? <Link href={`/blog?page=${page + 1}`} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-navy hover:bg-slate-50">Older →</Link> : <span />}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
