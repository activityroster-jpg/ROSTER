const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Serve a stored request screenshot privately: images only, never cached, never sniffed. */
export function screenshotResponse(object: R2ObjectBody | null): Response {
  if (!object) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  const type = object.httpMetadata?.contentType ?? "";
  return new Response(object.body, {
    headers: {
      "Content-Type": IMAGE_TYPES.has(type) ? type : "application/octet-stream",
      "Content-Disposition": IMAGE_TYPES.has(type) ? "inline" : "attachment",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
