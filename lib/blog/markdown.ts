/**
 * A tiny, safe Markdown→HTML renderer for the blog. Supports the subset the
 * articles use: ## / ### headings, paragraphs, - and 1. lists, > blockquotes,
 * **bold**, *italic* and [links](url). HTML in the source is escaped first, so
 * even though posts are admin-authored (trusted) there is no HTML injection.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // images ![alt](url) — must run before links. Only http(s) and relative paths.
  out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, alt: string, src: string) => {
    return `<img src="${src}" alt="${alt}" loading="lazy" class="my-6 w-full rounded-card border border-slate-200 object-cover" />`;
  });
  // links [text](http...) — only http(s) and relative paths
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, text: string, href: string) => {
    const rel = href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer nofollow"' : "";
    return `<a href="${href}"${rel} class="text-teal underline hover:text-teal-700">${text}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

/** Render a controlled Markdown subset to an HTML string. */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  const flushList = (ordered: boolean, items: string[]) => {
    const tag = ordered ? "ol" : "ul";
    const cls = ordered ? "list-decimal" : "list-disc";
    html.push(`<${tag} class="${cls} space-y-1.5 pl-6 text-slate-600">${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "") { i++; continue; }

    // Headings
    if (trimmed.startsWith("### ")) { html.push(`<h3 class="mt-6 font-display text-lg font-semibold text-navy">${inline(trimmed.slice(4))}</h3>`); i++; continue; }
    if (trimmed.startsWith("## ")) { html.push(`<h2 class="mt-8 font-display text-xl font-bold text-navy">${inline(trimmed.slice(3))}</h2>`); i++; continue; }
    if (trimmed.startsWith("# ")) { html.push(`<h2 class="mt-8 font-display text-2xl font-bold text-navy">${inline(trimmed.slice(2))}</h2>`); i++; continue; }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("> ")) { quote.push(lines[i]!.trim().slice(2)); i++; }
      html.push(`<blockquote class="border-l-4 border-teal bg-teal/5 px-4 py-2 text-slate-600 italic">${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i]!.trim())) { items.push(lines[i]!.trim().replace(/^[-*] /, "")); i++; }
      flushList(false, items);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]!.trim())) { items.push(lines[i]!.trim().replace(/^\d+\. /, "")); i++; }
      flushList(true, items);
      continue;
    }

    // Paragraph (gather until blank line)
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,3} |[-*] |\d+\. |> )/.test(lines[i]!.trim())) {
      para.push(lines[i]!.trim());
      i++;
    }
    html.push(`<p class="leading-relaxed text-slate-600">${inline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}

/** Rough reading time in minutes from a markdown body. */
export function readingMinutes(md: string): number {
  const words = md.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
