# Runbook: deploying and rolling back

## Try a change on staging

Nothing to do. Every push to the working branch deploys to
https://staging.activityroster.com within about five minutes. Sign in there with the
staging centre you created; emails appear under Dev Center → Outbox (and in your inbox
if a staging Resend key is set).

## Put a change into production (your approval)

1. GitHub → Actions → **Deploy production** → Run workflow → leave the branch as it is → Run workflow.
2. Wait for the green tick (about five minutes). The run summary shows the commit, the D1
   Time Travel bookmark taken before the deploy, and the tag created.
3. If the smoke test fails, the workflow rolls the Worker back to the previous version by
   itself and the run shows red. You get an email from GitHub.

What the run does: tests, build, records the restore point, applies any pending database
migrations, deploys, checks `/api/health`, the home page and `/login`, then tags the
commit and points `main` at it.

## Roll back the app (one click)

Cloudflare dashboard → Workers & Pages → **roster** → Deployments → find the previous
deployment → ⋯ → **Rollback**. Takes effect in seconds. This changes code only, not data.

## Roll back data (rare, talk to Claude Code first)

D1 Time Travel restores the whole database to a moment in the last 30 days. Each
production deploy's run summary carries the bookmark from just before it. Restoring
overwrites everything written since that moment, so it is a last resort; the restore
runbook (`docs/runbooks/restore.md`) covers the steps.

## If a migration fails

The run stops before deploying, so the live app keeps running the old code against the
old schema. Claude Code fixes the migration, pushes, you test on staging, then press
Deploy production again.

## Production deploy log

Each row is a "Deploy production" run Conor pressed. The bookmark is the D1 Time
Travel point taken immediately before that deploy; the workflow's run summary is
the source of truth and this table is a convenience copy.

| Date (UTC) | Commit | Bookmark | Contents |
|---|---|---|---|
| 2026-10-03 | 7c39fcd | (see run summary, tag `prod-20261003-1929`) | Password rule, strength meter, sign-out buttons, migrations 0040–0043 |
| 2026-10-03 | 7838db1 | `000001ca-00000000-000050f9-ff60ef9ec57b5ded297c390416b7680b` | Status page link; Cloudflare Turnstile on public forms and sign-in |
