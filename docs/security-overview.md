# Security overview (customer-facing)

The source for the public page at `/trust` (`app/(marketing)/trust/page.tsx`).
Keep the two in step; the page is the plain-English version.

- **Hosting:** Cloudflare Workers, D1 (western Europe), R2 (EU jurisdiction), KV. No servers of our own.
- **Tenant isolation:** `organisation_id` on every centre table, one repository layer, cross-tenant test suite on every deploy.
- **Authentication:** Better Auth; passwords ≥8 chars with at least one letter and one number (Conor's choice over the spec's 12), breached-password check, scrypt hashing; emailed sign-in code per device per 12 hours for office roles, with the centre worked out from the email (chooser when a person belongs to several); 4-digit PIN after the centre's idle timeout (30 minutes default, 5–240); optional TOTP 2FA with backup codes, required for the Dev Center; new-device check; per-IP and per-account throttling with owner alerts on repeated failure; sessions HttpOnly/Secure/Lax; office sessions end after 12 idle hours; sign-out-everywhere.
- **Roles:** admin, senior_instructor, welfare_officer, instructor, parent (`lib/auth/rbac.ts`); contact-detail sharing opt-in, off by default for under-18s; vetting checks status-only with encrypted references; `audit_log` and `security_event` append-only by trigger.
- **Retention and rights:** per-centre retention periods with 14-day notice and keep; per-person export, restriction and anonymisation; working-time checks for under-18s (block) and adults (warn).
- **Hardening:** HSTS preload, CSP with frame-ancestors none, nosniff, referrer and permissions policies; Zod on every input; Drizzle parameterised queries; server-action CSRF protection; authenticated-only document downloads; allow-listed upload types with byte sniffing.
- **Payments:** Stripe Checkout and Billing Portal; Stripe ids only; webhooks verified on the raw body and idempotent.
- **Logging:** centre change log; owner-side security events with IP/country/agent; Sentry (EU) with scrubbing.
- **Backups:** D1 Time Travel 30 days; nightly encrypted export to EU R2 (30 daily, 12 monthly); off-site copy; quarterly restore test; runbooks.
- **Privacy:** data-request form with 30-day acknowledgement; whole-centre export; deactivate-never-delete config; privacy notices linked in-app; terms version recorded per centre.
- **Disclosure:** security.txt, security@ address, good-faith safe harbour.
- **Public pages:** `/trust`, `/subprocessors` (from `lib/legal/subprocessors.ts`), `/accessibility`, `/privacy/young-people`.
