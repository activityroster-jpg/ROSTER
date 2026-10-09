"use client";

import { askConfirm } from "@/lib/ui/ask-confirm";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { seedArticlesAction, resyncArticlesAction, fetchCoverImageAction, fetchMissingCoversAction, refreshStaleCoversAction, setPostStatusAction, deletePostAction } from "@/app/admin/blog/actions";

export interface PostRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  publishAt: string | null; // ISO
  live: boolean;
  hasCover: boolean;
  coverUrl: string | null;
}

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function BlogAdminList({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? res.message ?? "Done" : res.error ?? "Failed");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog/new" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">＋ New post</Link>
          {posts.length === 0 ? (
            <button type="button" onClick={() => run(seedArticlesAction)} disabled={pending} className="rounded-lg border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">
              {pending ? "Seeding…" : "Seed 100 starter articles"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => run(seedArticlesAction)} disabled={pending} className="text-sm font-medium text-teal hover:underline disabled:opacity-50">
                {pending ? "Working…" : "Add any missing starter articles"}
              </button>
              <button type="button" onClick={() => run(resyncArticlesAction)} disabled={pending} title="Update existing articles' content from the latest starter text (keeps their publish dates)" className="text-sm font-medium text-teal hover:underline disabled:opacity-50">
                {pending ? "Working…" : "Re-sync article content"}
              </button>
              <button type="button" onClick={() => run(() => fetchMissingCoversAction(10))} disabled={pending} title="Fetch self-hosted cover images from Pexels for articles that don't have one (10 at a time)" className="text-sm font-medium text-teal hover:underline disabled:opacity-50">
                {pending ? "Working…" : "Fetch cover images (10)"}
              </button>
              <button type="button" onClick={() => run(() => refreshStaleCoversAction(10))} disabled={pending} title="Replace cover photos that don't match their article's subject any more (10 at a time; run until it says all done)" className="text-sm font-medium text-teal hover:underline disabled:opacity-50">
                {pending ? "Working…" : "Refresh covers to match articles (10)"}
              </button>
            </>
          )}
        </div>
        <span className="text-sm text-slate-500">{posts.length} post{posts.length === 1 ? "" : "s"}</span>
      </div>
      {msg ? <p role="status" className="mb-3 text-sm text-starboard">{msg}</p> : null}

      {posts.length === 0 ? (
        <div className="rounded-card border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">No posts yet. Seed the 100 starter articles (10 go live now, the rest publish two per day), or write your own.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="p-3">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Cover</th>
                <th className="p-3">Status</th>
                <th className="p-3">Publish date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="p-3"><Link href={`/admin/blog/${p.id}`} className="font-medium text-navy hover:text-teal hover:underline">{p.title}</Link></td>
                  <td className="p-3 text-slate-500">{p.category}</td>
                  <td className="p-3">
                    {p.hasCover && p.coverUrl ? (
                      <div className="flex items-center gap-2">
                        <img src={p.coverUrl} alt="" className="h-9 w-14 flex-none rounded border border-slate-200 object-cover" />
                        <button type="button" onClick={() => run(() => fetchCoverImageAction(p.id))} disabled={pending} title="Fetch a different photo" className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium text-teal hover:border-teal disabled:opacity-50">↻ Re-fetch</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => run(() => fetchCoverImageAction(p.id))} disabled={pending} className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium text-teal hover:border-teal disabled:opacity-50">Fetch image</button>
                    )}
                  </td>
                  <td className="p-3">
                    {p.status === "published" && p.live ? <span className="rounded-full bg-starboard/15 px-2 py-0.5 text-xs font-semibold text-starboard">Live</span>
                      : p.status === "published" ? <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-semibold text-amber">Scheduled</span>
                      : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Draft</span>}
                  </td>
                  <td className="p-3 text-slate-500">{fmt(p.publishAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/blog/${p.id}`} className="text-teal hover:underline">Edit</Link>
                      {p.status === "published"
                        ? <button type="button" onClick={() => run(() => setPostStatusAction(p.id, "draft"))} disabled={pending} className="text-slate-500 hover:underline">Unpublish</button>
                        : <button type="button" onClick={() => run(() => setPostStatusAction(p.id, "published"))} disabled={pending} className="text-slate-500 hover:underline">Publish</button>}
                      <button type="button" onClick={async () => { if (await askConfirm("Delete this post?")) run(() => deletePostAction(p.id)); }} disabled={pending} className="text-port hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
