/** @type {import('next').NextConfig} */

// Security headers applied to every response. The Content-Security-Policy is
// NOT here: middleware sets it (lib/security/csp.ts). On Workers, OpenNext
// copies these response headers onto the request too, and a static CSP there
// hid the per-request nonce from Next.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera (licence photos) and geolocation (clock-in) are used by our own pages
  // — including inside the native app's web view — so they must be allowed for self.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(self \"https://checkout.stripe.com\")" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keep server bundles lean for the Workers runtime.
    serverMinification: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
