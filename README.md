# ActivityRoster

Compliance-aware **staff rostering + course administration** for RYA sailing,
watersports schools, clubs and activity centres. A self-serve, multi-tenant
SaaS: one codebase, one deployment, every centre on its own subdomain
(`{slug}.activityroster.com`).

Its distinctive value is **compliance-aware rostering** — it won't let a session
run under-qualified, over-ratio, or without safety-boat cover, and it tracks
every ticket and vetting check so nothing lapses.

## Architecture at a glance

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) via OpenNext → Cloudflare Workers |
| Database | Cloudflare D1 (SQLite), single multi-tenant DB, EU-pinned |
| ORM | Drizzle |
| Auth | Better Auth (email/password + magic link, 2FA, org/membership RBAC) |
| Files | Cloudflare R2, private, EU jurisdiction, `org_{id}/…` keys |
| Billing | Stripe (Checkout + Billing + Customer Portal) |
| Validation | Zod on every external input |

### Tenancy — the most important decision

**One shared D1 database, tenant isolation enforced structurally in code and
proven by an automated test.**

- Every tenant-owned table carries `organisation_id` (NOT NULL, indexed).
- **All** tenant data access goes through `lib/db/repositories`, which injects
  the org filter on every read/write and forces the org id on every insert.
- The **cross-tenant isolation test** (`tests/isolation`) seeds two orgs and
  proves neither can reach the other's data, across every tenant table. It runs
  in CI and a failure blocks release.

Each centre starts identical and "branches off" purely through **configuration
data** (settings, roles, grades, compliance types, course types…), never a code
fork. See `CLAUDE.md` for the full conventions.

## Getting started

```bash
npm install
npm test                 # domain + isolation tests
npm run typecheck:core   # strict typecheck of the framework-independent core
npm run db:generate      # regenerate the Drizzle migration after a schema change
```

## Build phases

Each phase ends green (tests + isolation test pass):

- **Phase 0 — Foundations** ✅ schema, tenant resolution, TenantContext +
  repository layer, the isolation test, RYA seed catalogue, domain rules, CI.
- **Phase 1 — Marketing + self-serve signup** (Stripe Checkout, provisioning
  webhook, RYA-defaults seeding, magic-link onboarding, subscription gating).
- **Phase 2 — App shell + configuration** (Settings, Course setup).
- **Phase 3 — People & compliance** (staff, grades, fit-to-roster, expiry).
- **Phase 4 — Courses, sessions & resources** (assignment, conflict, ratios).
- **Phase 5 — Instructor portal + hours + comms.**
- **Phase 6 — Admin, audit & compliance** (dashboard, export/erasure, hardening).

## Data residency

Everything pins to the **EU** (D1 location, R2 jurisdiction) for GDPR residency.
