import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cf/bindings";

export const dynamic = "force-dynamic";

/**
 * Serve a public blog cover image from R2 (stored under the blog/ prefix). These
 * are public marketing assets — no auth — but we only ever read keys under blog/,
 * so this route can't be used to reach tenant documents.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  // key is a bare filename like "my-slug.jpg"; reject anything with a path.
  if (!key || key.includes("/") || key.includes("..")) {
    return NextResponse.json({ error: "Bad key" }, { status: 400 });
  }
  const object = await getEnv().DOCS.get(`blog/${key}`);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      // Public, long-lived — cover images rarely change.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
