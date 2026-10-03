# Environments, secrets and settings

Three environments. Names only here, never values.

| | Local | Staging | Production |
| --- | --- | --- | --- |
| URL | localhost | staging.activityroster.com, centres at {slug}.staging.activityroster.com | activityroster.com, centres at {slug}.activityroster.com |
| Worker | `wrangler dev` | `roster-staging` | `roster` |
| D1 | SQLite file / in-memory (tests) | `activityroster-staging` (western Europe) | `activityroster` (western Europe) |
| R2 | none | `activityroster-docs-staging` (EU jurisdiction) | `activityroster-docs` |
| KV | miniflare | `roster-staging-TENANT_CACHE` | `TENANT_CACHE` |
| Data | synthetic (`lib/seed`, tests) | synthetic only, never a copy of production | real |
| Email | logged, not sent | Dev Center → Outbox, and sent via Resend if a staging key is set | Resend |
| Deploys | – | automatic on every push (`.github/workflows/deploy-staging.yml`) | "Deploy production" button in GitHub Actions (`.github/workflows/deploy.yml`) |

## Worker secrets (Cloudflare → Workers & Pages → roster / roster-staging → Settings → Variables and Secrets)

| Name | What it is | Where it comes from | How to rotate |
| --- | --- | --- | --- |
| `BETTER_AUTH_SECRET` | Signs sessions and every signed cookie (PIN, login-verified, ghost) | Generated (32 random bytes, hex) | Set a new value and redeploy; everyone signs in again |
| `TOKEN_ENCRYPTION_KEY` | AES-GCM key for stored integration tokens | Generated | Rotating it invalidates stored integration tokens; reconnect integrations afterwards |
| `BETTER_AUTH_URL` | Base URL for auth links | `https://activityroster.com` / `https://staging.activityroster.com` | Edit if the domain changes |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails allowed into the Dev Center | Conor | Edit the list |
| `STRIPE_SECRET_KEY` | Stripe API key (restricted) | Stripe → Developers → API keys | Create a new restricted key, set it, delete the old one |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhooks | Stripe → Developers → Webhooks → endpoint → Roll secret | Roll in Stripe, set the new value |
| `STRIPE_PRICE_*` | Price ids per plan | Stripe → Products | Change when prices change |
| `RESEND_API_KEY` | Sends email | Resend → API Keys | Create new, set, delete old |
| `RESEND_WEBHOOK_SECRET` | Verifies Resend delivery/bounce webhooks | Resend → Webhooks → signing secret | Recreate the webhook |
| `ANTHROPIC_API_KEY` | Outreach agent research and drafting (prospect data only) | console.anthropic.com → API Keys | Create new, set, revoke old |
| `OUTREACH_CRON_SECRET` | Shared secret for the hourly tick | Generated; same value in the GitHub secret of the same name | Change both places |
| `SENTRY_DSN` | Error reporting (EU ingest) | Sentry project settings | Regenerate the DSN in Sentry |
| `FCM_SERVICE_ACCOUNT_JSON` | Push notifications for the mobile app | Firebase service account | Create a new key, set, delete old |
| `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`, `ANDROID_SHA256_FINGERPRINTS` | Universal / app links | App stores | Edit |
| `COMPANY_LEGAL_NAME`, `COMPANY_ADDRESS` | Shown in email footers | Companies House / your registered address | Edit |

Non-secret vars live in `wrangler.toml` (`APP_APEX_DOMAIN`, `APP_ENV`).

## GitHub repository secrets (Settings → Secrets and variables → Actions)

| Name | Used by |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | all deploy workflows; token needs Workers Scripts, KV, R2, D1, Routes and Zone DNS edit |
| `CLOUDFLARE_ACCOUNT_ID` | all deploy workflows |
| `OUTREACH_CRON_SECRET` | the hourly outreach tick |
| `STAGING_RESEND_API_KEY` (optional) | Provision staging: lets staging send real email |
| `STAGING_STRIPE_SECRET_KEY`, `STAGING_STRIPE_WEBHOOK_SECRET` (optional) | Provision staging: Stripe test mode |
| `STAGING_ANTHROPIC_API_KEY` (optional) | Provision staging: outreach agent on staging |
| `BACKUP_PASSPHRASE` | Nightly backup and Restore: encrypts every export. **Also kept in Conor's password manager**; without it backups cannot be read. 24+ characters. |
| `OFFSITE_S3_ENDPOINT`, `OFFSITE_S3_BUCKET`, `OFFSITE_S3_ACCESS_KEY_ID`, `OFFSITE_S3_SECRET_ACCESS_KEY` (optional until the account exists) | Nightly backup: off-Cloudflare copy to an S3-compatible bucket with object lock (recommended: Backblaze B2, EU region) |
| `R2_S3_ENDPOINT`, `R2_S3_ACCESS_KEY_ID`, `R2_S3_SECRET_ACCESS_KEY` (optional) | Nightly backup: read-only R2 API token so uploaded documents are included in the backup |

## Branches

- `claude/new-session-2wxbwe`: the working branch. Every push deploys to staging.
- `main`: a record of what is in production; updated by the production deploy, never edited by hand.
- Tags `prod-YYYYMMDD-HHMM`: one per production deploy.
