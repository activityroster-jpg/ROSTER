/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep server bundles lean for the Workers runtime.
    serverMinification: true,
  },
};

export default nextConfig;

// Enable OpenNext's Cloudflare bindings during `next dev` so D1/R2/KV are
// available locally. Guarded so it never runs in the built Worker.
if (process.env.NODE_ENV === "development") {
  try {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  } catch {
    // OpenNext not installed / not in a CF dev context — safe to ignore.
  }
}
