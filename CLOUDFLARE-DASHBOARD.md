# Deploy ActivityRoster — all Cloudflare, no local machine, no terminal

Everything below is done by clicking in the **Cloudflare** and **Stripe**
dashboards. You never install anything or run a command on your computer, and
GitHub's "Environments/Secrets" page is NOT used.

Where secrets live: **Cloudflare** (the running app reads them there). Not GitHub,
not your laptop.

---

## 1. Create the storage (Cloudflare dashboard)

Cloudflare dashboard → **Workers & Pages** / **Storage & Databases**:

1. **D1 database** → Create → name `activityroster`, location **Europe** →
   after it's made, copy its **Database ID**.
2. **KV namespace** → Create → name `TENANT_CACHE` → copy its **ID**.
3. **R2 bucket** → Create → name `activityroster-docs`, location **Europe**.

## 2. Put those two IDs into the repo (GitHub web editor — still no local machine)

On GitHub, open **`wrangler.toml`**, click the ✏️ pencil, and replace:
- `REPLACE_WITH_D1_DATABASE_ID` → your D1 Database ID
- `REPLACE_WITH_KV_NAMESPACE_ID` → your KV namespace ID

Commit the change.

## 3. Connect the repo to Cloudflare (Workers Builds)

Cloudflare → **Workers & Pages** → **Create** → **Import a repository** →
authorise GitHub → pick **activityroster-jpg/ROSTER**, branch
**`claude/new-session-2wxbwe`** (or `main` once merged). Set:
- **Build command:** `npx opennextjs-cloudflare build`
- **Deploy command:** `npx wrangler deploy`

Save and deploy. Cloudflare now builds and hosts the app on every push.

## 4. Load the database schema (D1 console — clicks)

Cloudflare → **D1** → `activityroster` → **Console**. Open
`lib/db/migrations/0000_petite_deathbird.sql` on GitHub, copy all of it, paste
into the console, and **Run**. (This creates every table.)

## 5. Add the secrets (Cloudflare dashboard)

Cloudflare → your Worker (`activityroster`) → **Settings** → **Variables and
Secrets**. Add these **Secrets** (encrypted):

| Name | Value |
|---|---|
| `BETTER_AUTH_SECRET` | `yKTdLyra/IpPUlr7poyL703N4OYNMu4Km96OPTVP3Ys=` |
| `STRIPE_SECRET_KEY` | your restricted key `rk_…` (step 7) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (step 7) |
| `STRIPE_PRICE_ROSTERING` | `price_…` (step 7) |
| `STRIPE_PRICE_FULL` | `price_…` (step 7) |
| `RESEND_API_KEY` | *(optional)* email sending |
| `SENTRY_DSN` | *(optional)* error reporting |

And these plain **Variables**:

| Name | Value |
|---|---|
| `APP_APEX_DOMAIN` | `activityroster.com` |
| `APP_ENV` | `production` |
| `BETTER_AUTH_URL` | `https://activityroster.com` |

## 6. Point your domain at the Worker

Cloudflare → your Worker → **Settings** → **Domains & Routes** → add:
- `activityroster.com`
- `*.activityroster.com` (wildcard — each centre's subdomain)

(Your domain must be on Cloudflare for this; add it under **Websites** if not.)

## 7. Stripe (Stripe dashboard — clicks only)

Stripe Dashboard:
1. **Products** → add product **Rostering** with a recurring price → copy its
   `price_…` → paste as `STRIPE_PRICE_ROSTERING` in Cloudflare (step 5). Repeat
   for **Full** → `STRIPE_PRICE_FULL`.
2. **Developers → API keys** → **Create restricted key** → copy `rk_…` → paste
   as `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks** → **Add endpoint** →
   `https://activityroster.com/api/webhooks/stripe` → select these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.subscription.trial_will_end`,
   `invoice.paid`, `invoice.payment_failed` → after creating, reveal the
   **Signing secret** `whsec_…` → paste as `STRIPE_WEBHOOK_SECRET`.

## 8. Redeploy

Cloudflare → your Worker → **Deployments** → **Retry / redeploy** (or push any
commit) so the new secrets and bindings take effect.

## 9. Test

Visit `https://activityroster.com`, claim a slug, and pay with Stripe test card
`4242 4242 4242 4242` (any future expiry, any CVC). Your centre should appear at
`https://<yourslug>.activityroster.com`.

---

### Notes
- Re-running the D1 console SQL isn't needed unless the schema changes; new
  migrations are added under `lib/db/migrations/` and pasted the same way.
- If a build fails, Cloudflare shows the log under the Worker's **Deployments**
  tab — send me that log and I'll fix it.
