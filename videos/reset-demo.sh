#!/usr/bin/env bash
# Puts the demo centre back exactly as seeded and restarts the app, so every
# video starts from the same place and none depends on what an earlier one
# did (the Make videos workflow runs this before each video: VIDEO_RESET).
#
#   bash videos/reset-demo.sh snapshot   keep a clean copy of the seeded database (once, after seeding)
#   bash videos/reset-demo.sh            restore that copy and restart the app
#
# CLEAN_DB is where the copy is kept. Only ever touches the throwaway local
# database under .wrangler/ (never staging or production).
set -euo pipefail
: "${CLEAN_DB:?set CLEAN_DB to where the clean copy of the seeded database is kept}"
DB="$(ls .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | grep -v metadata | head -1)"

if [ "${1:-}" = "snapshot" ]; then
  # Fold the write-ahead log into the file first, or the copy misses the newest rows.
  DB="$DB" node -e 'const D = require("better-sqlite3"); const db = new D(process.env.DB); db.pragma("wal_checkpoint(TRUNCATE)"); db.close();'
  cp "$DB" "$CLEAN_DB"
  echo "kept a clean copy of the demo database"
  exit 0
fi

# Stop the app (and the local database engine it started), then restore.
pkill -f "next dev -p 8787" || true
pkill -f "next-server" || true
pkill -f "workerd" || true
for _ in $(seq 1 50); do pgrep -f "next dev -p 8787|next-server|workerd" > /dev/null || break; sleep 0.2; done
rm -f "$DB-wal" "$DB-shm"
cp "$CLEAN_DB" "$DB"

# Start it again, detached, appending to the same log (the sign-in codes are read from it).
setsid nohup npx next dev -p 8787 >> "${DEV_LOG:-videos-dev.log}" 2>&1 < /dev/null &
for _ in $(seq 1 150); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 120 "${VIDEO_BASE:-http://demo.localhost:8788}/sign-in" || true)"
  [ "$code" = "200" ] && exit 0
  sleep 1
done
echo "the app didn't come back up" >&2
exit 1
