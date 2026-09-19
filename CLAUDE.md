# CLAUDE.md — ActivityRoster conventions

Compliance-aware staff rostering + course administration for RYA sailing /
watersports centres. Multi-tenant SaaS: **one codebase, one deployment.** Each
centre is identical at provisioning and "branches off" only through
**configuration data** — never forked code.

## Non-negotiables (a violation blocks release)

1. **Tenant isolation is structural, not vigilance-based.**
   - Every tenant-owned table has `organisation_id TEXT NOT NULL`, indexed.
   - **All tenant data access goes through `lib/db/repositories`.** App/route
     code may NEVER issue a raw or un-scoped query against a tenant table. The
     repository injects the org filter on every read and write, and forces the
     org id from the `TenantContext` on every insert.
   - Control-plane tables (`user`, `session`, `account`, `verification`,
     `organisation`, `membership`, `webhook_event`, `slug_reservation`) are the
     only tables reachable without a tenant filter, and only through the narrow,
     purpose-built methods in `ControlPlaneRepository`.
2. **The cross-tenant isolation test must stay green** (`tests/isolation`). It
   was written before features and proves no repository call, for any tenant
   table, can read or mutate another org's data. Add a tenant table → add it to
   `TENANT_TABLES` and `createTenantRepositories` in
   `lib/db/repositories/index.ts`; the test then covers it automatically.
3. **Authorise on the server for every request.** Resolve
   `(user, org from subdomain, membership + role)` and deny non-members. The
   subdomain is a HINT, never authorisation. A route that cannot build a
   `TenantContext` denies the request.
4. **Zod-validate every external input.** Never trust the client for price IDs,
   `organisation_id`, role, or slug.
5. **Stripe:** verify webhooks against the **raw body**; price IDs come from
   **env** and are validated server-side; store Stripe IDs only (no card data);
   idempotent by `event.id` (unique `webhook_event.stripe_event_id` + idempotent
   provisioning).

## Code conventions

- **TypeScript strict**; no `any` in app code. (Repository infra uses a couple
  of local casts at the generic boundary — keep them contained there.)
- Domain rules (conflict, fit-to-roster, ratio & safety cover) live as **pure
  functions** in `lib/domain` — no DB, no framework, no I/O.
- Config is **deactivate-never-delete**: config rows carry an `active` flag and
  the DB refuses to delete rows still referenced (RESTRICT foreign keys). Old
  records keep pointing at retired config and still render.
- Every roster / resource / settings / billing change writes to `audit_log`.
- Secrets only in Workers secrets/env — nothing sensitive in the client bundle.
- Keep Node-heavy libs out (Workers Node-compat is partial); prefer Drizzle +
  `fetch` clients. `better-sqlite3` is **test/dev only**.
- Small, phase-scoped changes; no new features mid-phase.

## Layout

```
app/            (marketing) · (app)/office · (app)/portal · api/*
lib/db/schema         Drizzle schema (control-plane + tenant), one migration path
lib/db/repositories   THE ONLY tenant data path (org-scoped)
lib/tenant            resolve org from host, TenantContext, reserved list
lib/domain            pure functions: conflict, fit-to-roster, ratio
lib/validation        Zod schemas
lib/auth              Better Auth + RBAC
lib/billing           Stripe: checkout, portal, webhooks
lib/r2                org-scoped file keys
lib/seed              RYA defaults (run on provisioning)
tests/isolation       cross-tenant test (must pass in CI)
```

## Commands

- `npm test` — full vitest suite (domain + isolation).
- `npm run test:isolation` — just the cross-tenant isolation test.
- `npm run typecheck:core` — strict typecheck of the framework-independent core.
- `npm run typecheck` — full typecheck (needs the Next.js/app deps installed).
- `npm run db:generate` — regenerate the Drizzle migration after a schema change.

## Data residency

Everything pins to the **EU** (D1 location, R2 jurisdiction) for GDPR. Sentry
runs with PII scrubbing on. Suspended centres can still export their data before
deletion within the retention window.
