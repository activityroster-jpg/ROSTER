# Security overview (customer-facing)

The source for the public page at `/trust` (`app/(marketing)/trust/page.tsx`).
Keep the two in step; the page is the plain-English version.

- **Hosting:** Cloudflare Workers, D1 (western Europe), R2 (EU jurisdiction), KV. No servers of our own.
- **Tenant isolation:** `organisation_id` on every centre table, one repository layer, cross-tenant test suite on every deploy.
- **Authentication:** Better Auth; passwords ≥8 chars with at least one letter and one number (Conor's choice over the spec's 12), breached-password check, scrypt hashing; emailed sign-in code per device per 12 hours for admins; 4-digit PIN after 30 idle minutes; optional TOTP 2FA with backup codes; new-device check; per-IP and per-account throttling; sessions HttpOnly/Secure/Lax; office sessions end after 12 idle hours.
- **Hardening:** HSTS preload, CSP with frame-ancestors none, nosniff, referrer and permissions policies; Zod on every input; Drizzle parameterised queries; server-action CSRF protection; authenticated-only document downloads; allow-listed upload types with byte sniffing.
- **Payments:** Stripe Checkout and Billing Portal; Stripe ids only; webhooks verified on the raw body and idempotent.
- **Logging:** centre change log; owner-side security events with IP/country/agent; Sentry (EU) with scrubbing.
- **Backups:** D1 Time Travel 30 days; nightly encrypted export to EU R2 (30 daily, 12 monthly); off-site copy; quarterly restore test; runbooks.
- **Privacy:** data-request form with 30-day acknowledgement; whole-centre export; deactivate-never-delete config; privacy notices linked in-app; terms version recorded per centre.
- **Disclosure:** security.txt, security@ address, good-faith safe harbour.
