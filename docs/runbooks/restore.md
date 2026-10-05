# Runbook: restoring data

Three cases, from quickest to slowest. Do the first one that fits. Every step that
changes production is done through GitHub Actions or the Cloudflare dashboard, never
from a laptop, and every restore is logged in `docs/restore-tests.md` (real or test).

Before any restore: write down the time of the problem, take the current Time Travel
bookmark (`wrangler d1 time-travel info activityroster` runs in every production deploy
summary, or Cloudflare → D1 → activityroster → Time Travel), and tell affected centres
via the status page if the platform is unavailable.

## Case A: undo a bad change in the last 30 days (D1 Time Travel)

Use when data was wrongly deleted or changed and you know roughly when.

1. Cloudflare dashboard → Workers & Pages → D1 → **activityroster** → **Time Travel** tab.
2. Choose the timestamp just before the problem (UTC). Preview if offered.
3. Press **Restore**. The whole database goes back to that moment. Anything written after
   it is lost, so do this as soon as possible and tell centres what window is affected.
4. Open the live site, check a centre's roster and staff list, and run the Deploy
   production workflow's smoke test by re-running the last successful deploy.
5. Log it in `docs/restore-tests.md`.

Claude Code can do steps 2 to 4 for you through a workflow if preferred; ask.

## Case B: restore from a nightly export (older than 30 days, or D1 unavailable)

Use when Time Travel cannot reach the point you need.

1. Backups live in the private EU bucket **activityroster-backups** under
   `daily/YYYY-MM-DD.sql.enc` (30 days) and `monthly/YYYY-MM.sql.enc` (12 months). Each is
   a full SQL export encrypted with the backup passphrase (in your password manager).
2. GitHub → Actions → **Restore from backup** → Run workflow → enter the file name and
   which database to restore into (`staging` to rehearse, `production` for real). The
   workflow downloads, decrypts, wipes the target database and replays the export, then
   re-applies migrations newer than the export and runs the smoke test.
3. Check the site as in Case A, step 4.
4. Replay the deletion log (Phase 2) so anything deleted after the backup stays deleted.
5. Log it.

## Monthly restore rehearsal (automatic)

On the 3rd of every month at 04:17 UTC, **Actions → Restore rehearsal** takes last
night's backup, decrypts it and loads it into a throwaway database in the EU
jurisdiction. It checks that every table's row count matches the backup file, applies any
newer migrations on top, runs an integrity check where D1 allows it, and then deletes the
throwaway database. Production and staging are never written to. Staging is avoided on
purpose because it can send email, and real people's data should not reach it.

The result is emailed to the platform owner ("Restore rehearsal passed …") and shown under
Last backup on the Dev Center overview. To rehearse now, or with an older file, press
**Run workflow** on it (leave the file box empty for last night's).

This proves the file restores. It does not replace a full drill of Case B, which is worth
doing once a year with Claude Code walking through it.

## Case C: rebuild in a fresh Cloudflare account (account lost or compromised)

1. New Cloudflare account on Workers Paid; add the domain or a temporary one.
2. In GitHub, replace `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` with the new
   account's, and update `database_id` / KV `id` in `wrangler.toml` once created (the
   Provision workflow pattern does this for staging; run it against production names).
3. Set every secret in `docs/environment.md` on the new Worker.
4. Fetch the latest encrypted export and the documents archive from the **off-site**
   copy (provider and bucket in `docs/subprocessors.md`), decrypt with the passphrase,
   and load via the Restore workflow pointed at the new database. Upload documents to the
   new R2 bucket with the same keys.
5. Point DNS at the new account, deploy production, smoke test, tell centres.
6. Rotate every secret that lived in the old account.

## DNS zone copy (monthly, automatic)

The `Monthly DNS zone export` workflow (Actions → Monthly DNS zone export) saves the
whole zone in BIND format on the 1st of each month: as a workflow artifact kept 90 days
and as `dns/YYYY-MM.txt` in the EU backup bucket. Case C step 5 uses it: in the new
account, DNS → Records → **Import and Export → Import**, choose the latest file, then
check the proxied (orange cloud) status of the apex, `www`, `staging` and the wildcard.
It needs the `CLOUDFLARE_ZONE_ID` secret and the API token to carry Zone → DNS → Read;
the workflow says so in plain words if either is missing.

## What is NOT restored

Stripe subscriptions (live in Stripe), Resend domains, GitHub. Sessions and PINs are in
the database and come back with it; people may need to sign in again.


## After any restore: replay deletions

A restore brings back everyone who was in the database at the bookmark, including people a
centre has since anonymised. Before handing the centre back, open its Dev Center page and
press **Replay deletions** (top of the Leaving box). It re-applies every anonymisation in
that centre's deletion log and reports how many it re-applied. Do this for every centre
that was restored.
