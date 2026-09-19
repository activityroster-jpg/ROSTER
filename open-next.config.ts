import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

/**
 * OpenNext → Cloudflare adapter config. Defaults are appropriate for a Workers
 * deployment; caching can be layered on later (R2/KV incremental cache) without
 * changing app code.
 */
export default defineCloudflareConfig({});
