#!/usr/bin/env bash
#
# Bootstrap Stripe for ActivityRoster — run this on YOUR machine (Stripe is not
# reachable from the cloud build environment).
#
# It uses the STRIPE_SECRET_KEY in .dev.vars to:
#   1. create the Rostering and Full products + recurring prices (idempotent via
#      price lookup keys),
#   2. create the /api/webhooks/stripe endpoint subscribed to all 8 events,
#   3. write STRIPE_PRICE_ROSTERING, STRIPE_PRICE_FULL and STRIPE_WEBHOOK_SECRET
#      back into .dev.vars.
#
# The ONE thing it cannot do: mint the secret key itself. Create a restricted
# key in the Stripe Dashboard (Developers → API keys) and put it in .dev.vars as
# STRIPE_SECRET_KEY first.
#
# Amounts/currency/interval are overridable via env, e.g.:
#   ROSTERING_AMOUNT=4900 FULL_AMOUNT=9900 CURRENCY=gbp INTERVAL=month ./scripts/stripe-bootstrap.sh
#
set -euo pipefail

ENV_FILE="${1:-.dev.vars}"
API="https://api.stripe.com/v1"

CURRENCY="${CURRENCY:-gbp}"
INTERVAL="${INTERVAL:-month}"
ROSTERING_AMOUNT="${ROSTERING_AMOUNT:-4900}"   # minor units (e.g. 4900 = £49.00)
FULL_AMOUNT="${FULL_AMOUNT:-9900}"

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE — copy .dev.vars.example first." >&2; exit 1; }

getvar() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

SK="$(getvar STRIPE_SECRET_KEY)"
APEX="$(getvar APP_APEX_DOMAIN)"; APEX="${APEX:-activityroster.com}"
# The webhook must point at the deployed apex, not localhost.
case "$APEX" in localhost*|"") APEX="activityroster.com";; esac

if [ -z "$SK" ]; then
  echo "STRIPE_SECRET_KEY is empty in $ENV_FILE." >&2
  echo "→ Create a restricted key at https://dashboard.stripe.com/apikeys and paste it in, then re-run." >&2
  exit 1
fi

api() { # method path [curl-data-args...]
  local method="$1" path="$2"; shift 2
  curl -sS -X "$method" "$API$path" -u "$SK:" "$@"
}
jget() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const p=process.argv[1].split(".");let v=j;for(const k of p)v=v?.[k];console.log(v??"")}catch{process.exit(0)}})' "$1"; }

# --- prices (idempotent by lookup_key) -------------------------------------
ensure_price() { # name lookup_key amount  → echoes price id
  local name="$1" lk="$2" amount="$3"
  local existing
  existing="$(api GET "/prices?lookup_keys[]=$lk&active=true&limit=1" | jget "data.0.id")"
  if [ -n "$existing" ]; then echo "$existing"; return; fi
  local product
  product="$(api POST "/products" -d "name=$name" | jget "id")"
  api POST "/prices" \
    -d "unit_amount=$amount" -d "currency=$CURRENCY" \
    -d "recurring[interval]=$INTERVAL" -d "product=$product" \
    -d "lookup_key=$lk" -d "transfer_lookup_key=true" | jget "id"
}

echo "Creating products & prices ($CURRENCY/$INTERVAL)…" >&2
PRICE_ROSTERING="$(ensure_price "ActivityRoster — Rostering" "rostering_${INTERVAL}" "$ROSTERING_AMOUNT")"
PRICE_FULL="$(ensure_price "ActivityRoster — Full" "full_${INTERVAL}" "$FULL_AMOUNT")"
echo "  Rostering: $PRICE_ROSTERING" >&2
echo "  Full:      $PRICE_FULL" >&2

# --- webhook endpoint ------------------------------------------------------
WEBHOOK_URL="https://$APEX/api/webhooks/stripe"
EVENTS=(
  checkout.session.completed
  checkout.session.async_payment_succeeded
  checkout.session.async_payment_failed
  customer.subscription.updated
  customer.subscription.deleted
  customer.subscription.trial_will_end
  invoice.paid
  invoice.payment_failed
)
EXISTING_WH="$(api GET "/webhook_endpoints?limit=100" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const url=process.argv[1];const m=(j.data||[]).find(e=>e.url===url);console.log(m?m.id:"")})' "$WEBHOOK_URL")"

WHSEC=""
if [ -n "$EXISTING_WH" ]; then
  echo "Webhook already exists ($EXISTING_WH). Its signing secret is only shown at creation." >&2
  echo "→ To rotate it, delete that endpoint in the dashboard and re-run, or copy whsec from the dashboard." >&2
else
  echo "Creating webhook → $WEBHOOK_URL" >&2
  ARGS=(-d "url=$WEBHOOK_URL"); for e in "${EVENTS[@]}"; do ARGS+=(-d "enabled_events[]=$e"); done
  RESP="$(api POST "/webhook_endpoints" "${ARGS[@]}")"
  WHSEC="$(printf '%s' "$RESP" | jget "secret")"
  [ -n "$WHSEC" ] && echo "  Signing secret captured." >&2 || echo "  WARNING: no secret in response: $RESP" >&2
fi

# --- write back into .dev.vars --------------------------------------------
setvar() { # KEY VALUE
  local key="$1" val="$2"
  [ -z "$val" ] && return 0
  if grep -qE "^$key=" "$ENV_FILE"; then
    node -e 'const fs=require("fs");const[f,k,v]=process.argv.slice(1);const s=fs.readFileSync(f,"utf8").split("\n").map(l=>l.startsWith(k+"=")?k+"="+v:l).join("\n");fs.writeFileSync(f,s)' "$ENV_FILE" "$key" "$val"
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}
setvar STRIPE_PRICE_ROSTERING "$PRICE_ROSTERING"
setvar STRIPE_PRICE_FULL "$PRICE_FULL"
setvar STRIPE_WEBHOOK_SECRET "$WHSEC"

echo "" >&2
echo "Done. Wrote price ids$([ -n "$WHSEC" ] && echo ' + webhook secret') into $ENV_FILE." >&2
echo "Next: ./scripts/setup-secrets.sh to push them to Cloudflare, then npm run cf:deploy." >&2
