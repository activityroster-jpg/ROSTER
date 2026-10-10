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
- Every roster / resource / settings / billing change writes to `audit_log`. `audit_log` and
  `security_event` are append-only, enforced by database triggers (migration 0046): never
  write code that updates or deletes a log row; erasing the owner is the only way they go.
- Secrets only in Workers secrets/env — nothing sensitive in the client bundle.
- Keep Node-heavy libs out (Workers Node-compat is partial); prefer Drizzle +
  `fetch` clients. `better-sqlite3` is **test/dev only**.
- Small, phase-scoped changes; no new features mid-phase.
- **Every new user-facing feature ships with a guide.** Add a section to the
  Learning Centre (`components/marketing/LearningCenter.tsx`, served at `/learn`)
  and link to it from the feature's own page in the platform via
  `/learn?topic=<sectionId>` (a "📖 Read the guide" link). The Learning Centre
  supports deep-linking to any section by its id.

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

## Security, privacy, compliance & resilience

The standing brief is **`docs/compliance-spec.md`** (Conor, 3 Oct 2026). Read it before
touching auth, permissions, personal data, email, backups or deploys. The audit against
it is `docs/compliance-gap-report.md`; the phased plan is `docs/compliance-plan.md`.

Working rules from the spec, binding on every session:

1. **Audit first, then plan, then ask.** Each compliance phase starts only after Conor
   approves it. Flag conflicts between the spec and the app rather than redesigning.
2. **Protect production data.** No migration, delete or bulk update on production
   without testing on staging first and recording the D1 Time Travel bookmark. Until
   staging exists, every production SQL is additive and given to Conor as a plain block
   to paste; once staging is provisioned, migrations run only through the deploy workflow.
3. **Never commit secrets.** Cloudflare secrets and env only. No production personal
   data in the repo, in logs or in docs.
4. **Plain English, no scripts for Conor.** Automate recurring work in the cloud (GitHub
   Actions, Workers); when a dashboard step is unavoidable, say exactly what to click.
5. **Legal figures are data.** Hour limits and similar rules live in versioned data
   (rule packs), never hard-coded, and are marked verified or unverified. Working-time
   packs: built-in copies in `lib/rules/working-time/packs.ts`, edits in the `rule_pack`
   table via Dev Center → Rules, validated by `lib/rules/working-time/schema.ts`; the
   checks in `lib/domain/working-time.ts` read figures only from the pack they are given.
6. **Minors are children under GDPR.** Under-18 staff get higher-privacy defaults; never
   add messaging, profiling or marketing that reaches them.
7. **Change management:** every push to the working branch deploys to **staging**
   (`staging.activityroster.com`) after typecheck and tests; **production deploys only
   when Conor presses "Deploy production"** in GitHub Actions, which records the D1 Time
   Travel bookmark, applies pending migrations, deploys, smoke-tests and rolls back on
   failure (`docs/runbooks/deploy.md`). Never trigger that workflow yourself; tell Conor
   what the deploy contains and ask him to press it. Migrations are additive (add,
   migrate, remove later) and are never pasted into the production console again.
   Deploys only from GitHub; `main` is the record of production, not a working branch.
8. **New third party that touches personal data → add it to `docs/subprocessors.md`
   first** and tell Conor, who notifies customers.
