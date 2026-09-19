#!/usr/bin/env bash
#
# Push production secrets to the Cloudflare Worker from a local env file.
#
# Usage:
#   ./scripts/setup-secrets.sh [path-to-env-file]   # default: .dev.vars
#
# Reads KEY=VALUE lines and runs `wrangler secret put KEY` for each non-empty
# SECRET (skips the non-secret vars, which live in wrangler.toml [vars]).
# Blank values are skipped so you can fill Stripe/Resend in later.
#
set -euo pipefail

ENV_FILE="${1:-.dev.vars}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No env file at '$ENV_FILE'. Copy .dev.vars.example → .dev.vars and fill it in." >&2
  exit 1
fi

# Secrets to upload (everything sensitive). Non-secret vars (APP_APEX_DOMAIN,
# APP_ENV, BETTER_AUTH_URL) belong in wrangler.toml [vars], not here.
SECRETS=(
  BETTER_AUTH_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_ROSTERING
  STRIPE_PRICE_FULL
  RESEND_API_KEY
  SENTRY_DSN
)

echo "Uploading secrets from $ENV_FILE to Cloudflare…"
for key in "${SECRETS[@]}"; do
  # Extract the value for this key (strip surrounding quotes, ignore comments).
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
  if [ -z "$value" ]; then
    echo "  · $key — blank, skipped"
    continue
  fi
  printf '%s' "$value" | npx wrangler secret put "$key"
  echo "  ✓ $key"
done

echo "Done. Remember: STRIPE_* and RESEND_API_KEY must be your real account keys."
