import { getEnv } from "@/lib/cf/bindings";
import { VIDEO_FILES } from "@/lib/learn/videos";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { mp4: "video/mp4", png: "image/png", vtt: "text/vtt; charset=utf-8" };

/**
 * The website's how-to videos (and their poster and captions), streamed from
 * storage with byte ranges so the player can seek. Only the files listed in
 * lib/learn/videos are served; there is nothing personal in them (a made-up
 * centre), so they're public and cached.
 */
async function serve(req: Request, params: Promise<{ file: string }>, head: boolean): Promise<Response> {
  const { file } = await params;
  if (!VIDEO_FILES.has(file)) return new Response("Not found", { status: 404 });
  const key = `public/videos/${file}`;
  const bucket = getEnv().DOCS;
  const meta = await bucket.head(key);
  if (!meta) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const size = meta.size;
  const headers: Record<string, string> = {
    "Content-Type": TYPES[file.split(".").pop()!] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    ETag: meta.httpEtag,
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (!range || (range[1] === "" && range[2] === "")) {
    headers["Content-Length"] = String(size);
    if (head) return new Response(null, { headers });
    const obj = await bucket.get(key);
    return obj ? new Response(obj.body, { headers }) : new Response("Not found", { status: 404 });
  }
  let start: number, end: number;
  if (range[1] === "") { start = Math.max(0, size - Number(range[2])); end = size - 1; }
  else { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1; }
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  headers["Content-Length"] = String(end - start + 1);
  if (head) return new Response(null, { status: 206, headers });
  const obj = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
  return obj ? new Response(obj.body, { status: 206, headers }) : new Response("Not found", { status: 404 });
}

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return serve(req, params, false);
}

export async function HEAD(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return serve(req, params, true);
}
