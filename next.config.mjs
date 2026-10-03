/** @type {import('next').NextConfig} */

// Security headers applied to every response. The CSP is deliberately pragmatic:
// it locks the dangerous vectors (framing, object/embed, base-uri, external
// script origins) while allowing the inline script/style Next.js and Tailwind
// emit. Stripe Checkout/Portal are full-page redirects, so no embedding is needed.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Inline scripts are still allowed here because the marketing pages are
  // prerendered. The signed-in app also receives a nonce policy (report-only)
  // from middleware — see lib/security/csp.ts for how to enforce it.
  "script-src 'self' 'unsafe-inline'",
  // Only the hosts the browser actually talks to: our own origin, Stripe.js (if
  // ever embedded) and Sentry's EU/US ingest. Everything else is server-side.
  "connect-src 'self' https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
