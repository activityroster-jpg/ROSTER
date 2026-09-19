# Deploying ActivityRoster to Cloudflare

One codebase, one Worker, one D1 database. Everything pins to the EU.

## 1. Create the Cloudflare resources (once)

```bash
# D1 database (EU)
npx wrangler d1 create activityroster --location=weur
# → copy the database_id into wrangler.toml ([[d1_databases]].database_id)

# R2 bucket for private documents (EU)
npx wrangler r2 bucket create activityroster-docs --location=weur

# KV namespace for tenant-lookup caching + rate limiting
npx wrangler kv namespace create TENANT_CACHE
# → copy the id into wrangler.toml ([[kv_namespaces]].id)
```

Apply the database schema:

```bash
npm run db:migrate:remote     # wrangler d1 migrations apply activityroster --remote
```

## 2. Secrets

Local dev already works: `.dev.vars` was generated with a strong
`BETTER_AUTH_SECRET`. Fill in your own Stripe/Resend keys there when you want
billing and email locally (blank = billing disabled, emails logged not sent).

For production, put your keys in `.dev.vars` (or any env file) and run:

```bash
./scripts/setup-secrets.sh              # pushes each non-empty secret to the Worker
```

What each secret is:

| Secret | Where it comes from |
|---|---|
| `BETTER_AUTH_SECRET` | Generated for you (`openssl rand -base64 32` to rotate) |
| `STRIPE_SECRET_KEY` | Stripe dashboard — use a **restricted** key |
| `STRIPE_WEBHOOK_SECRET` | The webhook endpoint you add for `/api/webhooks/stripe` |
| `STRIPE_PRICE_ROSTERING` / `STRIPE_PRICE_FULL` | Stripe Products → Prices |
| `RESEND_API_KEY` | Resend (optional; emails are logged without it) |
| `SENTRY_DSN` | Sentry (optional) |

Non-secret vars (`APP_APEX_DOMAIN`, `APP_ENV`) live in `wrangler.toml [vars]`.

## 3. Stripe webhook

In the Stripe dashboard, add a webhook to
`https://<apex>/api/webhooks/stripe` for these events:
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`. Copy its signing
secret into `STRIPE_WEBHOOK_SECRET`.

## 4. DNS & domains

- `activityroster.com` and `www` → the Worker (marketing + signup).
- A wildcard `*.activityroster.com` record → the Worker (each centre's app).
- Add both as custom domains / routes for the Worker.

The auth cookie is scoped to `.activityroster.com` for cross-subdomain sessions;
membership is still re-checked on every request.

## 5. Deploy

```bash
npm run cf:deploy     # opennextjs-cloudflare build && wrangler deploy
```

## Local development

```bash
npm run dev           # Next dev with OpenNext CF bindings (reads .dev.vars)
# or a full Workers preview:
npm run cf:preview    # opennextjs-cloudflare build && wrangler dev
```
