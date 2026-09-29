"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostAction, updatePostAction, deletePostAction, type BlogResult } from "@/app/admin/blog/actions";

export interface PostInitial {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  category?: string;
  tags?: string;
  author?: string;
  coverEmoji?: string;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  publishAt?: string; // yyyy-mm-ddThh:mm for the input
}

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function PostEditor({ initial }: { initial: PostInitial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (fd: FormData) => {
    setMsg(null);
    start(async () => {
      const res: BlogResult = initial.id ? await updatePostAction(initial.id, fd) : await createPostAction({ ok: false }, fd);
      if (res.ok) {
        setMsg({ ok: true, text: res.message ?? "Saved" });
        if (!initial.id && res.id) router.push(`/admin/blog/${res.id}`);
        else router.refresh();
      } else setMsg({ ok: false, text: res.error ?? "Could not save" });
    });
  };

  const remove = () => {
    if (!initial.id) return;
    if (!confirm("Delete this post permanently?")) return;
    start(async () => {
      const res = await deletePostAction(initial.id!);
      if (res.ok) router.push("/admin/blog");
      else setMsg({ ok: false, text: res.error ?? "Could not delete" });
    });
  };

  return (
    <form action={submit} className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div>
          <label className={label} htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={initial.title} required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="excerpt">Excerpt / summary</label>
          <textarea id="excerpt" name="excerpt" defaultValue={initial.excerpt} rows={2} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="body">Body (Markdown)</label>
          <textarea id="body" name="body" defaultValue={initial.body} rows={22} className={`${field} font-mono text-xs leading-relaxed`} />
          <p className="mt-1 text-xs text-slate-400">Supports ## headings, - lists, 1. lists, **bold**, *italic*, [links](https://…) and &gt; quotes.</p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-card border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-navy">Publishing</p>
          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={initial.status ?? "draft"} className={field}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="publishAt">Publish at</label>
              <input id="publishAt" name="publishAt" type="datetime-local" defaultValue={initial.publishAt} className={field} />
              <p className="mt-1 text-xs text-slate-400">A future date + Published status = scheduled (auto-appears then).</p>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-navy">Details</p>
          <div className="space-y-3">
            <div><label className={label} htmlFor="slug">Slug</label><input id="slug" name="slug" defaultValue={initial.slug} placeholder="auto from title" className={field} /></div>
            <div><label className={label} htmlFor="category">Category</label><input id="category" name="category" defaultValue={initial.category ?? "Guides"} className={field} /></div>
            <div><label className={label} htmlFor="tags">Tags (comma-separated)</label><input id="tags" name="tags" defaultValue={initial.tags} className={field} /></div>
            <div><label className={label} htmlFor="coverEmoji">Cover emoji</label><input id="coverEmoji" name="coverEmoji" defaultValue={initial.coverEmoji ?? "⛵"} className={field} /></div>
            <div><label className={label} htmlFor="author">Author</label><input id="author" name="author" defaultValue={initial.author ?? "The ActivityRoster Team"} className={field} /></div>
          </div>
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-navy">SEO</p>
          <div className="space-y-3">
            <div><label className={label} htmlFor="seoTitle">SEO title</label><input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} className={field} /></div>
            <div><label className={label} htmlFor="seoDescription">SEO description</label><textarea id="seoDescription" name="seoDescription" defaultValue={initial.seoDescription} rows={3} className={field} /></div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{pending ? "Saving…" : initial.id ? "Save" : "Create"}</button>
          {initial.id ? <button type="button" onClick={remove} disabled={pending} className="text-sm font-medium text-port hover:underline">Delete</button> : null}
        </div>
        {msg ? <p role="status" className={`text-sm ${msg.ok ? "text-starboard" : "text-port"}`}>{msg.text}</p> : null}
      </aside>
    </form>
  );
}
