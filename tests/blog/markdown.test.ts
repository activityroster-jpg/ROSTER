import { describe, it, expect } from "vitest";
import { renderMarkdown, readingMinutes } from "@/lib/blog/markdown";

describe("renderMarkdown", () => {
  it("renders headings, paragraphs and lists", () => {
    const html = renderMarkdown("## Title\n\nA paragraph.\n\n- one\n- two");
    expect(html).toContain("<h2");
    expect(html).toContain("Title");
    expect(html).toContain("<p");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>one</li>");
  });

  it("renders bold, italic and safe links", () => {
    const html = renderMarkdown("Some **bold** and *italic* and a [link](https://example.com).");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("escapes HTML in the source (no injection)", () => {
    const html = renderMarkdown("Watch out <script>alert(1)</script> here");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not linkify javascript: URLs", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("<a href=\"javascript:");
  });

  it("estimates reading time", () => {
    expect(readingMinutes("word ".repeat(400))).toBe(2);
    expect(readingMinutes("short")).toBe(1);
  });
});
