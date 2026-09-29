import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { renderMarkdown, readingMinutes } from "@/lib/blog/markdown";

export const dynamic = "force-dynamic";

const fmtDate = (v: Date | number | null) => {
  if (v == null) return "";
  const ms = v instanceof Date ? v.getTime() : Number(v);
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};

async function load(slug: string) {
  try {
    const repo = new PlatformRepository(await getDb());
    return await repo.getPublishedPostBySlug(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) return { title: "Blog — ActivityRoster" };
  return {
    title: post.seoTitle || `${post.title} | ActivityRoster`,
    description: post.seoDescription || post.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) notFound();

  const html = renderMarkdown(post.body);
  const mins = readingMinutes(post.body);
  const tags = post.tags.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/blog" className="text-sm text-slate-400 hover:text-navy">← All articles</Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-teal/10 to-navy/10 text-3xl">{post.coverEmoji}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-teal">{post.category}</span>
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">{post.title}</h1>
      <p className="mt-3 text-lg text-slate-600">{post.excerpt}</p>
      <p className="mt-3 text-sm text-slate-400">{post.author} · {fmtDate(post.publishAt)} · {mins} min read</p>

      <div className="mt-8 space-y-4 border-t border-slate-100 pt-8" dangerouslySetInnerHTML={{ __html: html }} />

      {tags.length ? (
        <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-100 pt-6">
          {tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">{t}</span>)}
        </div>
      ) : null}

      <div className="mt-12 rounded-card border border-teal bg-navy p-8 text-center text-white">
        <h2 className="font-display text-2xl font-bold">Run your centre the easy way</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">ActivityRoster handles rostering, qualifications, safety-cover checks and more — purpose-built for RYA sailing and watersports centres.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/#get-demo" className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-700">Start a free month</a>
          <Link href="/learn" className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">Learning Centre</Link>
        </div>
      </div>
    </article>
  );
}
